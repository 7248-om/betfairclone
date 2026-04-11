/**
 * @file controllers/masterController.js
 * @description API endpoints for MASTER agents to securely access their clients' data.
 *
 * ============================================================
 * SECURITY MODEL — MANDATORY OWNERSHIP CHECK
 * ============================================================
 * Every client-specific endpoint MUST verify that:
 *   client.createdBy === req.user._id  (for MASTER accounts)
 *
 * This prevents a rogue MASTER from querying another master's clients
 * by guessing ObjectIds.
 *
 * MAIN accounts bypass the ownership check and can query any user.
 *
 * The helper function `findClientWithOwnershipCheck()` encapsulates
 * this pattern so it is applied consistently in every handler.
 *
 * Routes (defined in routes/master.js):
 *   GET /api/master/client/:clientId/statement      → getClientStatement
 *   GET /api/master/client/:clientId/profit-loss    → getClientProfitLoss
 *   GET /api/master/client/:clientId/bets           → getClientBets
 */

"use strict";

const mongoose = require("mongoose");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Bet = require("../models/Bet");

// ============================================================
// PRIVATE HELPER — Ownership check
// ============================================================

/**
 * Validates that a client exists AND belongs to the requesting master.
 * MAIN accounts skip the ownership check and can query any user.
 *
 * @param {string} clientId - The :clientId URL param
 * @param {object} requestingUser - req.user (the logged-in MASTER or MAIN)
 * @returns {object|null} The client User document, or null if not found/unauthorized
 */
const findClientWithOwnershipCheck = async (clientId, requestingUser) => {
  // Validate that the clientId is a valid ObjectId before hitting the DB
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    return { error: "Invalid client ID.", statusCode: 400 };
  }

  const client = await User.findById(clientId).select("username accountType createdBy isActive balance");

  if (!client) {
    return { error: "Client not found.", statusCode: 404 };
  }

  // Target must be a CLIENT — masters cannot spy on other masters' financials
  if (client.accountType !== "CLIENT") {
    return { error: "Target account is not a CLIENT.", statusCode: 400 };
  }

  // MAIN can access any client. MASTER can only access their own clients.
  if (
    requestingUser.accountType === "MASTER" &&
    client.createdBy?.toString() !== requestingUser._id.toString()
  ) {
    return {
      error: "Access denied. This client does not belong to your account.",
      statusCode: 403,
    };
  }

  // Return the client document on success
  return { client };
};

// ============================================================
// SECTION 1: CLIENT ACCOUNT STATEMENT (from Master's perspective)
// ============================================================

/**
 * GET /api/master/client/:clientId/statement
 * @desc  Returns the full Transaction ledger for a specific client,
 *        after verifying the requesting master owns that client.
 * @access Private (MASTER, MAIN)
 *
 * Query params:
 *   page, limit, startDate, endDate (same as client's own endpoint)
 */
const getClientStatement = async (req, res) => {
  try {
    // ---- Ownership Check ----
    const result = await findClientWithOwnershipCheck(req.params.clientId, req.user);
    if (result.error) {
      return res.status(result.statusCode).json({ error: result.error });
    }
    const { client } = result;

    // ---- Build query ----
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = { user: client._id };
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      client: {
        id: client._id,
        username: client.username,
        balance: client.balance,
        isActive: client.isActive,
      },
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: transactions,
    });
  } catch (err) {
    console.error("[getClientStatement]", err);
    return res.status(500).json({ error: "Failed to fetch client statement." });
  }
};

// ============================================================
// SECTION 2: CLIENT PROFIT & LOSS (from Master's perspective)
// ============================================================

/**
 * GET /api/master/client/:clientId/profit-loss
 * @desc  Aggregates the betting P&L for a specific client.
 *        Useful for masters to identify high-volume or high-risk clients.
 * @access Private (MASTER, MAIN)
 */
const getClientProfitLoss = async (req, res) => {
  try {
    // ---- Ownership Check ----
    const result = await findClientWithOwnershipCheck(req.params.clientId, req.user);
    if (result.error) {
      return res.status(result.statusCode).json({ error: result.error });
    }
    const { client } = result;

    // ---- Build match stage ----
    const matchStage = { user: client._id };
    if (req.query.startDate || req.query.endDate) {
      matchStage.createdAt = {};
      if (req.query.startDate) matchStage.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.createdAt.$lte = end;
      }
    }

    // ---- Aggregate ----
    const pnlResult = await Transaction.aggregate([
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
          netPnl: {
            $subtract: [
              { $add: ["$totalWinnings", "$totalRefunds"] },
              "$totalStaked",
            ],
          },
        },
      },
    ]);

    const summary = pnlResult[0] || {
      totalStaked: 0,
      totalWinnings: 0,
      totalRefunds: 0,
      totalTransferIn: 0,
      transactionCount: 0,
      netPnl: 0,
    };

    return res.status(200).json({
      success: true,
      client: { id: client._id, username: client.username },
      dateRange: {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
      },
      data: summary,
    });
  } catch (err) {
    console.error("[getClientProfitLoss]", err);
    return res.status(500).json({ error: "Failed to compute client profit & loss." });
  }
};

// ============================================================
// SECTION 3: CLIENT BET HISTORY (from Master's perspective)
// ============================================================

/**
 * GET /api/master/client/:clientId/bets
 * @desc  Returns a client's full bet history (open, won, lost, void).
 *        Useful for masters to audit a client's betting activity.
 * @access Private (MASTER, MAIN)
 *
 * Query params:
 *   status  {string} 'OPEN' | 'WON' | 'LOST' | 'VOID' (optional)
 *   page    {number}
 *   limit   {number}
 */
const getClientBets = async (req, res) => {
  try {
    // ---- Ownership Check ----
    const result = await findClientWithOwnershipCheck(req.params.clientId, req.user);
    if (result.error) {
      return res.status(result.statusCode).json({ error: result.error });
    }
    const { client } = result;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = { user: client._id };

    // Optional status filter (validate to prevent injection)
    const VALID_STATUSES = ["OPEN", "WON", "LOST", "VOID"];
    if (req.query.status) {
      if (!VALID_STATUSES.includes(req.query.status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        });
      }
      query.status = req.query.status;
    }

    // Optional date range
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
        .populate("match", "teams sport startTime status")
        .lean(),
      Bet.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      client: { id: client._id, username: client.username },
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: bets,
    });
  } catch (err) {
    console.error("[getClientBets]", err);
    return res.status(500).json({ error: "Failed to fetch client bets." });
  }
};
// ============================================================
// SECTION 4: MASTER'S CLIENT LIST
// ============================================================

/**
 * GET /api/master/clients
 * @desc  Returns all CLIENT accounts created by this MASTER.
 *        Computes active bets count and P&L dynamically.
 * @access Private (MASTER)
 */
const getMyClients = async (req, res) => {
  try {
    // 1. Fetch all child clients
    const clients = await User.find({
      createdBy: req.user._id,
      accountType: "CLIENT",
    })
      .select("username balance isActive createdAt")
      .lean();

    // 2. Fetch aggregate stats for each client in parallel
    const enhancedClients = await Promise.all(
      clients.map(async (client) => {
        // Active bets (OPEN)
        const activeBets = await Bet.countDocuments({
          user: client._id,
          status: "OPEN",
        });

        // P&L calculation
        const pnlResult = await Transaction.aggregate([
          { $match: { user: client._id } },
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
            },
          },
          {
            $addFields: {
              netPnl: {
                $subtract: [
                  { $add: ["$totalWinnings", "$totalRefunds"] },
                  "$totalStaked",
                ],
              },
            },
          },
        ]);

        const netPnl = pnlResult.length > 0 ? pnlResult[0].netPnl : 0;

        return {
          id: client._id,
          username: client.username,
          balance: client.balance,
          status: client.isActive ? "ACTIVE" : "SUSPENDED",
          activeBets,
          pl: netPnl,
          // Format date slightly
          joinedAt: new Date(client.createdAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "2-digit",
          }),
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: enhancedClients.length,
      data: enhancedClients,
    });
  } catch (err) {
    console.error("[getMyClients]", err);
    return res.status(500).json({ error: "Failed to fetch clients list." });
  }
};
// ============================================================
// SECTION 5: MASTER-TO-CLIENT TRANSFER
// ============================================================

/**
 * POST /api/master/transfer
 * @desc  Transfers coins from the logged-in MASTER to a specified CLIENT.
 *        Both must have sufficient balance (Master must have enough).
 * @access Private (MASTER)
 * Body: { clientId, amount }
 */
const transferCoins = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { clientId, amount } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Amount must be a positive number." });
    }

    // Validate ownership
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Invalid client ID." });
    }

    const client = await User.findById(clientId).session(session);
    if (!client || client.accountType !== "CLIENT" || client.createdBy?.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Client not found in your downline." });
    }

    // Refresh Master balance to ensure they have funds
    const master = await User.findById(req.user._id).session(session);
    if (master.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Insufficient balance for this transfer." });
    }

    // Deduct from Master
    master.balance -= amount;
    await master.save({ session });

    // Add to Client
    client.balance += amount;
    await client.save({ session });

    // Ledger: Master Out
    await Transaction.create([{
      user: master._id,
      type: "TRANSFER_OUT",
      amount,
      runningBalance: master.balance,
      description: `Transferred to client: ${client.username}`,
      referenceId: client._id,
      referenceModel: "User",
    }], { session });

    // Ledger: Client In
    await Transaction.create([{
      user: client._id,
      type: "TRANSFER_IN",
      amount,
      runningBalance: client.balance,
      description: `Received from agent: ${master.username}`,
      referenceId: master._id,
      referenceModel: "User",
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: `Successfully transferred ${amount} VC to ${client.username}`,
      newBalance: master.balance
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[transferCoins]", err);
    return res.status(500).json({ error: "Transfer failed." });
  }
};

module.exports = {
  getMyClients,
  getClientStatement,
  getClientProfitLoss,
  getClientBets,
  transferCoins,
};
