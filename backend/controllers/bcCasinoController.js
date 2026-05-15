/**
 * @file controllers/bcCasinoController.js
 * @description BetConstruct Casino Integration API 3.1.4 — Webhook Handlers
 *
 * ============================================================
 * ARCHITECTURE
 * ============================================================
 * Casino (3.1.4):  { ResponseCode, Description, Data: { ... } }
 *
 *   POST /api/casino/GetBalance  — Return the player's current balance.
 *   POST /api/casino/Deposit     — Credit the player (win / bonus).
 *   POST /api/casino/Withdraw    — Debit the player (bet placement).
 *   POST /api/casino/Rollback    — Reverse a Deposit or Withdraw.
 *
 * ============================================================
 * RESPONSE CONTRACT (Casino Integration API 3.1.4)
 * ============================================================
 *   ResponseCode  | Meaning
 *   ─────────────────────────────────────────────────────────
 *   0             | Success
 *   1             | User not found / invalid token
 *   2             | Insufficient funds (Withdraw only)
 *   3             | Transaction already exists (Idempotent)
 *   4             | Transaction not found (Rollback only)
 *   5             | Internal error
 *   1700          | Hash / authentication failure
 */

"use strict";

const mongoose    = require("mongoose");
const jwt         = require("jsonwebtoken");
const User        = require("../models/User");
const Transaction = require("../models/Transaction");

// ── Response helpers ─────────────────────────────────────────────────────────

const casinoReply = (res, code, description, data = {}) =>
  res.status(200).json({
    ResponseCode: Number(code),
    Description:  description,
    Data:         data,
  });

const casinoOk  = (res, data = {})          => casinoReply(res, 0, "Success", data);
const casinoErr = (res, code, description)  => casinoReply(res, code, description);

// ── Decode JWT Token ─────────────────────────────────────────────────────────

const decodeToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET).id;
  } catch {
    return null;
  }
};

// ── GetBalance ───────────────────────────────────────────────────────────────

const getBalance = async (req, res, next) => {
  try {
    const userId = decodeToken(req.body.Token);
    if (!userId) return casinoErr(res, 1, "Invalid Token. User not found.");

    const user = await User.findById(userId).select("balance isActive");
    if (!user)          return casinoErr(res, 1, "User not found.");
    if (!user.isActive) return casinoErr(res, 1, "User account is inactive.");

    return casinoOk(res, {
      Balance: parseFloat(user.balance.toFixed(2)),
    });
  } catch (err) { next(err); }
};

// ── Deposit ──────────────────────────────────────────────────────────────────

const deposit = async (req, res, next) => {
  try {
    const { Token, TransactionId, Amount, GameId, RoundId } = req.body;
    const credit = parseFloat(Amount);

    if (isNaN(credit) || credit < 0) {
      return casinoErr(res, 5, "Invalid Amount value.");
    }

    // ── Idempotency OUTSIDE session ────────────────────────────────────────
    // On a BC retry we return immediately without opening a Mongoose session,
    // which wastes a replica-set transaction slot.
    const existing = await Transaction.findOne({
      externalTxId: String(TransactionId),
      type:         "BET_WON",
    }).lean();

    if (existing) {
      const userId = decodeToken(Token);
      const u = userId ? await User.findById(userId).select("balance") : null;
      return casinoOk(res, {
        Balance:       u ? parseFloat(u.balance.toFixed(2)) : 0,
        TransactionId: String(TransactionId),
      });
    }

    // Only open a session when we actually need to mutate data.
    const session = await mongoose.startSession();
    session.startTransaction();
    try {

    // ── Resolve user ──────────────────────────────────────────
    const userId = decodeToken(Token);
    if (!userId) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 1, "Invalid Token.");
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 1, "User not found.");
    }
    if (!user.isActive) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 1, "User account is inactive.");
    }

    // ── Atomic credit with $inc (consistent with withdraw pattern) ────────
    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { balance: credit } },
      { new: true, session }
    );

    // ── Ledger entry ──────────────────────────────────────────
    await Transaction.create([{
      user:           user._id,
      type:           "BET_WON",
      amount:         credit,
      runningBalance: parseFloat(updated.balance.toFixed(2)),
      externalTxId:   String(TransactionId),
      description:    `Casino:Deposit:${TransactionId}${GameId ? `:Game:${GameId}` : ""}${RoundId ? `:Round:${RoundId}` : ""}`,
      referenceModel: "Casino",
    }], { session });

    await session.commitTransaction(); session.endSession();
    return casinoOk(res, {
      Balance:       parseFloat(updated.balance.toFixed(2)),
      TransactionId: String(TransactionId),
    });
    } catch (err) {
      await session.abortTransaction(); session.endSession();
      next(err);
    }
  } catch (err) { next(err); }
};

// ── Withdraw ─────────────────────────────────────────────────────────────────

const withdraw = async (req, res, next) => {
  try {
    const { Token, TransactionId, Amount, GameId, RoundId } = req.body;
    const debit = parseFloat(Amount);

    if (isNaN(debit) || debit < 0) {
      return casinoErr(res, 5, "Invalid Amount value.");
    }

    // ── Idempotency OUTSIDE session ────────────────────────────────────────
    // C-3 FIX: Previously the session was opened before this check, and the
    // findOne() had no .session() — two concurrent identical Withdraw calls
    // would both see no existing record and both proceed. Moving the check
    // outside the session means it reads committed data, and the unique index
    // on externalTxId (C-1 fix) is the final safety net.
    const existing = await Transaction.findOne({
      externalTxId: String(TransactionId),
      type:         "BET_PLACED",
    }).lean();

    if (existing) {
      const userId = decodeToken(Token);
      const u = userId ? await User.findById(userId).select("balance") : null;
      return casinoOk(res, {
        Balance:       u ? parseFloat(u.balance.toFixed(2)) : 0,
        TransactionId: String(TransactionId),
      });
    }

    // Only open a session when a mutation is actually needed.
    const session = await mongoose.startSession();
    session.startTransaction();
    try {

    // ── Resolve user ──────────────────────────────────────────
    const userId = decodeToken(Token);
    if (!userId) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 1, "Invalid Token.");
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 1, "User not found.");
    }
    if (!user.isActive) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 1, "User account is inactive.");
    }

    // ── Insufficient funds (pre-check for clean error response) ──────────
    if (user.balance < debit) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 2, "Insufficient balance.");
    }

    // ── Atomic debit with $gte guard ──────────────────────────
    // findOneAndUpdate with $gte guard is the only safe pattern for debits —
    // it prevents race conditions between concurrent Withdraw calls for the
    // same user playing multiple games simultaneously.
    const updated = await User.findOneAndUpdate(
      { _id: user._id, balance: { $gte: debit } },
      { $inc: { balance: -debit } },
      { new: true, session }
    );
    if (!updated) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 2, "Insufficient balance (concurrent update).");
    }

    // ── Ledger entry ──────────────────────────────────────────
    await Transaction.create([{
      user:           user._id,
      type:           "BET_PLACED",
      amount:         debit,
      runningBalance: parseFloat(updated.balance.toFixed(2)),
      externalTxId:   String(TransactionId),
      description:    `Casino:Withdraw:${TransactionId}${GameId ? `:Game:${GameId}` : ""}${RoundId ? `:Round:${RoundId}` : ""}`,
      referenceModel: "Casino",
    }], { session });

    await session.commitTransaction(); session.endSession();
    return casinoOk(res, {
      Balance:       parseFloat(updated.balance.toFixed(2)),
      TransactionId: String(TransactionId),
    });
    } catch (err) {
      await session.abortTransaction(); session.endSession();
      next(err);
    }
  } catch (err) { next(err); }
};

// ── Rollback ─────────────────────────────────────────────────────────────────

const rollback = async (req, res, next) => {
  try {
    const {
      Token,
      TransactionId,          // The new rollback transaction ID (idempotency)
      RelatedTransactionId,   // The original Withdraw/Deposit being reversed
      Amount,
      GameId,
      RoundId,
    } = req.body;

    // ── Idempotency OUTSIDE session ────────────────────────────────────────
    // C-4 FIX: Previously opened a session then ran the idempotency query
    // without .session(). Two concurrent rollbacks would both pass the check,
    // both credit the user, both create Transaction records — double-credit.
    // Moving this check outside the session (reading committed data) plus the
    // unique index on externalTxId is the correct defense.
    const alreadyRolled = await Transaction.findOne({
      externalTxId: String(TransactionId),
    }).lean();

    if (alreadyRolled) {
      const userId = decodeToken(Token);
      const u = userId ? await User.findById(userId).select("balance") : null;
      return casinoOk(res, {
        Balance:       u ? parseFloat(u.balance.toFixed(2)) : 0,
        TransactionId: String(TransactionId),
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {

    // ── Find the original transaction ─────────────────────────
    const originalTx = await Transaction.findOne({
      externalTxId: String(RelatedTransactionId),
    }).session(session);

    if (!originalTx) {
      // Original transaction not found — nothing to roll back.
      // Per BC spec, respond success so BC stops retrying.
      await session.commitTransaction(); session.endSession();
      const userId = decodeToken(Token);
      const u = userId ? await User.findById(userId).select("balance") : null;
      return casinoOk(res, {
        Balance:       u ? parseFloat(u.balance.toFixed(2)) : 0,
        TransactionId: String(TransactionId),
      });
    }

    // ── Resolve user ──────────────────────────────────────────
    const userId = decodeToken(Token);
    if (!userId) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 1, "Invalid Token.");
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 1, "User not found.");
    }

    // ── Determine reversal direction ──────────────────────────
    const isWithdrawRollback = originalTx.type === "BET_PLACED";

    const parsedAmount = parseFloat(Amount);
    const refundAmount = !isNaN(parsedAmount) ? parsedAmount : originalTx.amount;

    let updated;
    if (isWithdrawRollback) {
      // Refund the debit — simple $inc credit
      updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { balance: refundAmount } },
        { new: true, session }
      );
    } else {
      // Reverse a Deposit — debit, but never go below 0
      updated = await User.findOneAndUpdate(
        { _id: user._id },
        [{ $set: { balance: { $max: [{ $subtract: ["$balance", refundAmount] }, 0] } } }],
        { new: true, session }
      );
    }

    // ── Ledger entry ──────────────────────────────────────────
    await Transaction.create([{
      user:           user._id,
      type:           isWithdrawRollback ? "BET_REFUND" : "BET_PLACED",
      amount:         refundAmount,
      runningBalance: parseFloat(updated.balance.toFixed(2)),
      externalTxId:   String(TransactionId),
      description:    `Casino:Rollback:${TransactionId}:Related:${RelatedTransactionId}${GameId ? `:Game:${GameId}` : ""}${RoundId ? `:Round:${RoundId}` : ""}`,
      referenceModel: "Casino",
    }], { session });

    await session.commitTransaction(); session.endSession();
    return casinoOk(res, {
      Balance:       parseFloat(updated.balance.toFixed(2)),
      TransactionId: String(TransactionId),
    });
    } catch (err) {
      await session.abortTransaction(); session.endSession();
      next(err);
    }
  } catch (err) { next(err); }
};

module.exports = { getBalance, deposit, withdraw, rollback };
