/**
 * @file controllers/clientController.js
 * @description All API endpoints for the CLIENT tier.
 *
 * NOTE (BetConstruct migration): bet PLACEMENT is now handled by the
 * BetConstruct iFrame + /api/bc/BetPlaced webhook. The `placeBet`
 * endpoint has been removed from this controller. The remaining
 * endpoints provide account reporting and preference management.
 *
 * Routes (defined in routes/client.js):
 *   GET  /api/client/statement               → getStatement
 *   GET  /api/client/profit-loss             → getProfitLoss
 *   GET  /api/client/bets/history            → getBetHistory
 *   GET  /api/client/bets/unsettled          → getUnsettledBets
 *   PUT  /api/client/preferences/stakes      → updateStakePreferences
 *   PUT  /api/client/password                → changePassword
 */

"use strict";

const mongoose    = require("mongoose");
const Transaction = require("../models/Transaction");
const Bet         = require("../models/Bet");
const User        = require("../models/User");

// ============================================================
// SECTION 1: ACCOUNT STATEMENT
// ============================================================

/**
 * GET /api/client/statement
 * @desc  Returns a paginated list of all transactions for the logged-in client,
 *        newest first. Each entry includes the running balance at that point in time.
 * @access Private (CLIENT)
 *
 * Query params:
 *   page    {number} [default: 1]
 *   limit   {number} [default: 20, max: 100]
 *   startDate {string} ISO date string (optional)
 *   endDate   {string} ISO date string (optional)
 */
const getStatement = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build optional date filter
    const dateFilter = {};
    if (req.query.startDate) dateFilter.$gte = new Date(req.query.startDate);
    if (req.query.endDate) {
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end day
      dateFilter.$lte = end;
    }

    const query = {
      user: req.user._id,
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // .lean() for read performance — returns plain JS objects
      Transaction.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: transactions,
    });
  } catch (err) {
    console.error("[getStatement]", err);
    return res.status(500).json({ error: "Failed to fetch account statement." });
  }
};

// ============================================================
// SECTION 2: PROFIT & LOSS REPORT
// ============================================================

/**
 * GET /api/client/profit-loss
 * @desc  Aggregates the client's betting activity over a date range.
 *        Returns totalStake, totalWinnings, totalRefunds, and net P&L.
 * @access Private (CLIENT)
 *
 * Query params:
 *   startDate {string} ISO date string (optional)
 *   endDate   {string} ISO date string (optional)
 */
const getProfitLoss = async (req, res) => {
  try {
    // ---- Build the date-range match stage ----
    const matchStage = { user: req.user._id };
    if (req.query.startDate || req.query.endDate) {
      matchStage.createdAt = {};
      if (req.query.startDate) matchStage.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.createdAt.$lte = end;
      }
    }

    // ---- Aggregate transactions by type ----
    // We group into three buckets:
    //   "debit"   → BET_PLACED (money out)
    //   "credit"  → BET_WON + BET_REFUND (money in from betting)
    const result = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalStaked: {
            $sum: { $cond: [{ $eq: ["$type", "BET_PLACED"] }, "$amount", 0] },
          },
          totalWinnings: {
            $sum: { $cond: [{ $eq: ["$type", "BET_WON"] }, "$amount", 0] },
          },
          totalRefunds: {
            $sum: { $cond: [{ $eq: ["$type", "BET_REFUND"] }, "$amount", 0] },
          },
          totalTransferIn: {
            $sum: { $cond: [{ $eq: ["$type", "TRANSFER_IN"] }, "$amount", 0] },
          },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $addFields: {
          // Net P&L = Winnings + Refunds - Total Staked (from a betting perspective)
          netPnl: {
            $subtract: [
              { $add: ["$totalWinnings", "$totalRefunds"] },
              "$totalStaked",
            ],
          },
        },
      },
    ]);

    // If no transactions found, return zeros
    const summary = result[0] || {
      totalStaked: 0,
      totalWinnings: 0,
      totalRefunds: 0,
      totalTransferIn: 0,
      transactionCount: 0,
      netPnl: 0,
    };

    return res.status(200).json({
      success: true,
      dateRange: {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
      },
      data: summary,
    });
  } catch (err) {
    console.error("[getProfitLoss]", err);
    return res.status(500).json({ error: "Failed to compute profit & loss report." });
  }
};

// ============================================================
// SECTION 3: BET HISTORY (Settled bets)
// ============================================================

/**
 * GET /api/client/bets/history
 * @desc  Returns a paginated list of the client's settled bets (WON, LOST, VOID).
 * @access Private (CLIENT)
 *
 * Query params:
 *   page      {number}
 *   limit     {number}
 *   status    {string} 'WON' | 'LOST' | 'VOID' (optional filter)
 *   startDate {string}
 *   endDate   {string}
 */
const getBetHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Base query: settled bets for this user
    const query = {
      user: req.user._id,
      status: { $in: ["WON", "LOST", "RETURNED", "CASHED_OUT", "VOID"] },
    };

    // Narrow to a specific status if provided
    if (req.query.status && ["WON", "LOST", "RETURNED", "CASHED_OUT", "VOID"].includes(req.query.status)) {
      query.status = req.query.status;
    }

    // Optional date range on bet placement time
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const [bets, total] = await Promise.all([
      Bet.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bet.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: bets,
    });
  } catch (err) {
    console.error("[getBetHistory]", err);
    return res.status(500).json({ error: "Failed to fetch bet history." });
  }
};

// ============================================================
// SECTION 4: UNSETTLED BETS (Open / In-play)
// ============================================================

/**
 * GET /api/client/bets/unsettled
 * @desc  Returns the client's open (unsettled) bets. These are bets that have
 *        been placed but the match result has not yet been settled.
 * @access Private (CLIENT)
 */
const getUnsettledBets = async (req, res) => {
  try {
    const bets = await Bet.find({
      user: req.user._id,
      status: "OPEN",
    })
      .sort({ createdAt: -1 })
      // Hard limit: prevents unbounded response if many OPEN bets accumulate
      // due to a data integrity issue. Real-time open bets rarely exceed 50.
      .limit(200)
      .lean();

    // Compute total exposure (total amount at risk)
    const totalExposure = bets.reduce((sum, bet) => sum + (bet.bcAmount || 0), 0);

    return res.status(200).json({
      success: true,
      totalExposure,
      count: bets.length,
      data: bets,
    });
  } catch (err) {
    console.error("[getUnsettledBets]", err);
    return res.status(500).json({ error: "Failed to fetch unsettled bets." });
  }
};

// ============================================================
// SECTION 5: UPDATE STAKE PREFERENCES
// ============================================================

/**
 * PUT /api/client/preferences/stakes
 * @desc  Updates the client's quick-bet stake chip array.
 * @access Private (CLIENT)
 *
 * Body: { stakes: [100, 500, 1000, 5000] }
 *   - Must be an array of 1–8 positive numbers.
 */
const updateStakePreferences = async (req, res) => {
  try {
    const { stakes } = req.body;

    // ---- Validation ----
    if (!Array.isArray(stakes)) {
      return res.status(400).json({ error: "stakes must be an array of numbers." });
    }
    if (stakes.length === 0 || stakes.length > 8) {
      return res.status(400).json({ error: "stakes must contain between 1 and 8 values." });
    }
    if (stakes.some((s) => typeof s !== "number" || s <= 0 || !Number.isFinite(s))) {
      return res.status(400).json({ error: "Each stake value must be a positive number." });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { stakePreferences: stakes },
      { new: true, runValidators: true }
    ).select("stakePreferences");

    return res.status(200).json({
      success: true,
      message: "Stake preferences updated.",
      data: { stakePreferences: user.stakePreferences },
    });
  } catch (err) {
    console.error("[updateStakePreferences]", err);
    return res.status(500).json({ error: "Failed to update stake preferences." });
  }
};

// ============================================================
// SECTION 6: CHANGE PASSWORD
// ============================================================

/**
 * PUT /api/client/password
 * @desc  Allows a logged-in client to change their own password.
 *        Requires the current password to prevent account takeover.
 * @access Private (CLIENT)
 *
 * Body: { currentPassword: string, newPassword: string }
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // ---- Input validation ----
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "New password must be different from the current password." });
    }

    // Re-fetch user with password field (it has select: false by default)
    const user = await User.findById(req.user._id).select("+password");

    // Verify the current password is correct
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    // Assign and save — the pre-save hook will hash the new password automatically
    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please log in again.",
    });
  } catch (err) {
    console.error("[changePassword]", err);
    return res.status(500).json({ error: "Failed to change password." });
  }
};

// ---- Export all handlers ----
// NOTE: placeBet has been removed — bet placement is now handled by
// BetConstruct via the /api/bc/BetPlaced webhook endpoint.
module.exports = {
  getStatement,
  getProfitLoss,
  getBetHistory,
  getUnsettledBets,
  updateStakePreferences,
  changePassword,
};
