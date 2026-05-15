/**
 * @file controllers/adminController.js
 * @description All MAIN (super-admin) tier management endpoints.
 *
 * Mounted at: /api/admin
 * All routes require: protect + authorize('MAIN')
 *
 * Endpoints:
 *   POST /api/admin/mint               → mintCoins (add to treasury)
 *   POST /api/admin/masters            → createMaster
 *   GET  /api/admin/masters            → listMasters
 *   PUT  /api/admin/masters/:id/status → toggleMasterStatus (activate/suspend)
 */

"use strict";

const mongoose = require("mongoose");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const bcrypt = require("bcryptjs");

// ============================================================
// SECTION 1: MINT VIRTUAL COINS
// ============================================================

/**
 * POST /api/admin/mint
 * @desc  The exclusive super-admin power: creates new virtual coins
 *        and adds them directly to the logged-in MAIN user's balance.
 *        This is the only way new coins enter the economy.
 * @access Private (MAIN only)
 * Body: { amount: number, reason?: string }
 */
const mintCoins = async (req, res) => {
  // Use a Mongoose session for atomicity — user balance + transaction ledger must both succeed
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, reason, targetMasterUsername } = req.body;

    // ---- Validation ----
    if (!amount || typeof amount !== "number" || amount <= 0 || !Number.isFinite(amount)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "amount must be a positive number." });
    }
    if (amount > 10_000_000) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Cannot mint more than 10,000,000 VC in a single operation." });
    }

    let targetUser = req.user;
    let isMintingToMaster = false;

    // ---- Check if minting to a Master ----
    if (targetMasterUsername) {
      targetUser = await User.findOne({ username: targetMasterUsername, accountType: "MASTER" }).session(session);
      if (!targetUser) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Master account not found." });
      }
      isMintingToMaster = true;
    }

    // ---- Increment the targeted user's balance ----
    const updatedUser = await User.findByIdAndUpdate(
      targetUser._id,
      { $inc: { balance: amount } },
      { new: true, session }
    );

    // ---- Record the mint in the Transaction ledger ----
    await Transaction.create(
      [
        {
          user: targetUser._id,
          type: "TRANSFER_IN", // Minting is treated as an inbound transfer
          amount,
          runningBalance: updatedUser.balance,
          description: reason
            ? `Coin mint: ${reason}`
            : isMintingToMaster 
              ? `Coin mint by MAIN Admin` 
              : `Coin mint to treasury`,
          referenceId: isMintingToMaster ? req.user._id : null,
          referenceModel: isMintingToMaster ? "User" : null,
        },
      ],
      { session }
    );

    // ---- If Master was targeted, log it in MAIN's ledger too ----
    if (isMintingToMaster) {
      // TechnicallyMAIN balance didn't hold it, but we can log that MAIN minted coins externally
      // Alternatively, we just leave it on the Master's ledger. The requirement only strictly asks to mint to them.
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: `${amount.toLocaleString()} VC minted and added to ${isMintingToMaster ? targetUser.username : 'your balance'}.`,
      data: {
        amountMinted: amount,
        newBalance: updatedUser.balance,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[mintCoins]", err);
    return res.status(500).json({ error: "Failed to mint coins. Transaction rolled back." });
  }
};

// ============================================================
// SECTION 2: CREATE MASTER ACCOUNT
// ============================================================

/**
 * POST /api/admin/masters
 * @desc  Creates a new MASTER agent account and optionally funds it
 *        by transferring coins from the MAIN balance.
 * @access Private (MAIN only)
 * Body: { username, email, password, initialBalance?: number }
 */
const createMaster = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { username, email, password, initialBalance = 0 } = req.body;

    // ---- Validation ----
    if (!username || !email || !password) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "username, email, and password are required." });
    }
    if (password.length < 8) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    if (initialBalance < 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "initialBalance cannot be negative." });
    }
    // FIX: Use a fresh balance read INSIDE the session, not req.user.balance
    // (which was set at auth-middleware time and may be stale for concurrent requests).
    const adminUser = await User.findById(req.user._id).session(session);
    if (initialBalance > 0 && adminUser.balance < initialBalance) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Insufficient balance to fund this master account." });
    }

    // ---- Check for duplicate username/email ----
    const existingUser = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
    }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        error: `A user with this ${existingUser.username === username.toLowerCase() ? "username" : "email"} already exists.`,
      });
    }

    // ---- Create the MASTER user (pre-save hook hashes the password) ----
    const [newMaster] = await User.create(
      [
        {
          username,
          email,
          password,
          accountType: "MASTER",
          balance: initialBalance,
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    // ---- If initial balance provided: deduct from MAIN + create ledger entries ----
    if (initialBalance > 0) {
      // Atomic debit with $gte guard — prevents concurrent createMaster requests
      // from driving the MAIN balance negative (the pre-check above can be TOCTOU'd).
      const updatedAdmin = await User.findOneAndUpdate(
        { _id: req.user._id, balance: { $gte: initialBalance } },
        { $inc: { balance: -initialBalance } },
        { new: true, session }
      );
      if (!updatedAdmin) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "Insufficient balance (concurrent update)." });
      }

      // MAIN outbound transaction
      await Transaction.create(
        [
          {
            user: req.user._id,
            type: "TRANSFER_OUT",
            amount: initialBalance,
            runningBalance: updatedAdmin.balance,
            description: `Initial funding for new master: ${newMaster.username}`,
            referenceId: newMaster._id,
            referenceModel: "User",
          },
        ],
        { session }
      );

      // MASTER inbound transaction
      await Transaction.create(
        [
          {
            user: newMaster._id,
            type: "TRANSFER_IN",
            amount: initialBalance,
            runningBalance: initialBalance,
            description: `Account opened by ${req.user.username}`,
            referenceId: req.user._id,
            referenceModel: "User",
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: `Master account '${newMaster.username}' created successfully.`,
      data: {
        id: newMaster._id,
        username: newMaster.username,
        email: newMaster.email,
        balance: newMaster.balance,
        createdAt: newMaster.createdAt,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[createMaster]", err);
    if (err.code === 11000) {
      return res.status(409).json({ error: "Username or email already exists." });
    }
    return res.status(500).json({ error: "Failed to create master account." });
  }
};

// ============================================================
// SECTION 3: LIST ALL MASTERS
// ============================================================

/**
 * GET /api/admin/masters
 * @desc  Returns all MASTER accounts with their key stats.
 * @access Private (MAIN only)
 * Query params: status ('ACTIVE' | 'SUSPENDED', optional)
 */
const listMasters = async (req, res) => {
  try {
    const filter = { accountType: "MASTER" };

    if (req.query.status === "ACTIVE") filter.isActive = true;
    else if (req.query.status === "SUSPENDED") filter.isActive = false;

    const masters = await User.find(filter)
      .select("username email balance isActive createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: masters.length,
      data: masters,
    });
  } catch (err) {
    console.error("[listMasters]", err);
    return res.status(500).json({ error: "Failed to retrieve master accounts." });
  }
};

// ============================================================
// SECTION 4: TOGGLE MASTER STATUS (Activate / Suspend)
// ============================================================

/**
 * PUT /api/admin/masters/:id/status
 * @desc  Activates or suspends a MASTER account.
 *        Any active JWT tokens held by the master will be rejected by
 *        the `protect` middleware's live isActive check.
 * @access Private (MAIN only)
 * Body: { isActive: boolean }
 */
const toggleMasterStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be a boolean." });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid master ID." });
    }

    const master = await User.findOne({ _id: id, accountType: "MASTER" });
    if (!master) {
      return res.status(404).json({ error: "Master account not found." });
    }

    master.isActive = isActive;
    await master.save();

    return res.status(200).json({
      success: true,
      message: `Master '${master.username}' has been ${isActive ? "reactivated" : "suspended"}.`,
      data: { id: master._id, username: master.username, isActive: master.isActive },
    });
  } catch (err) {
    console.error("[toggleMasterStatus]", err);
    return res.status(500).json({ error: "Failed to update master status." });
  }
};

module.exports = { mintCoins, createMaster, listMasters, toggleMasterStatus };
