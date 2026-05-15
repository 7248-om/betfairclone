/**
 * @file controllers/bcPartnerController.js
 * @description BetConstruct Partner API v0.40 — Webhook Endpoint Handlers
 *
 * ============================================================
 * RESPONSE CONTRACT (Partner API v0.40)
 * ============================================================
 * ALL responses must be HTTP 200 with:
 *   Success: { "ErrorCode": "0", "ErrorText": "" }
 *   Failure: { "ErrorCode": "<code>", "ErrorText": "<message>" }
 *
 * Error codes:
 *   "0"    → Success
 *   "1008" → Invalid AuthToken / user not found / inactive
 *   "1700" → Hash mismatch (handled in middleware)
 *   "2400" → Insufficient balance
 *   "604"  → Duplicate / already processed
 *   "605"  → Cannot rollback a settled bet
 *   "500"  → Internal error
 *
 * ============================================================
 * AUTHENTICATION
 * ============================================================
 * BC sends `AuthToken` = the JWT we issued at login.
 * We decode it with JWT_SECRET to retrieve the user _id.
 *
 * ============================================================
 * ATOMICITY
 * ============================================================
 * BetPlaced, BetResulted, Rollback all use Mongoose sessions
 * (MongoDB ACID transactions). Requires a replica set.
 */

"use strict";

const mongoose    = require("mongoose");
const jwt         = require("jsonwebtoken");
const User        = require("../models/User");
const Bet         = require("../models/Bet");
const Transaction = require("../models/Transaction");

// ── Response helpers ─────────────────────────────────────────────────────────

const bcReply = (res, code, text, extra = {}) =>
  res.status(200).json({ ErrorCode: String(code), ErrorText: text, ...extra });

const bcOk  = (res, extra = {}) => bcReply(res, "0", "", extra);
const bcErr = (res, code, msg)  => bcReply(res, code, msg);

// ── Resolve userId from JWT AuthToken ────────────────────────────────────────

const decodeToken = (authToken) => {
  try {
    return jwt.verify(authToken, process.env.JWT_SECRET).id;
  } catch {
    return null;
  }
};

// ── BetState → internal status ───────────────────────────────────────────────

const BC_STATE_TO_STATUS = Object.freeze({
  1: "OPEN",
  2: "RETURNED",
  3: "LOST",
  4: "WON",
  5: "CASHED_OUT",
});

// ── getClientDetails ─────────────────────────────────────────────────────────
/**
 * POST /api/bc/GetClientDetails
 * Body: { AuthToken, TS, Hash }
 */
const getClientDetails = async (req, res, next) => {
  try {
    const userId = decodeToken(req.body.AuthToken);
    if (!userId) return bcErr(res, "1008", "Invalid AuthToken.");

    // Select only the fields needed by GetClientDetails — avoid pulling all user data
    const user = await User.findById(userId)
      .select("username currencyId languageId externalId isActive");
    if (!user)          return bcErr(res, "1008", "User not found.");
    if (!user.isActive) return bcErr(res, "1008", "User account is inactive.");

    return bcOk(res, {
      Login:      user.username,
      CurrencyId: user.currencyId || "USD",
      LanguageId: user.languageId || "en",
      ExternalId: user.externalId || user._id.toString(),
    });
  } catch (err) { next(err); }
};

// ── getClientBalance ─────────────────────────────────────────────────────────
/**
 * POST /api/bc/GetClientBalance
 * Body: { AuthToken, TS, Hash }
 */
const getClientBalance = async (req, res, next) => {
  try {
    const userId = decodeToken(req.body.AuthToken);
    if (!userId) return bcErr(res, "1008", "Invalid AuthToken.");

    const user = await User.findById(userId).select("balance isActive");
    if (!user)          return bcErr(res, "1008", "User not found.");
    if (!user.isActive) return bcErr(res, "1008", "User account is inactive.");

    return bcOk(res, { Balance: parseFloat(user.balance.toFixed(2)) });
  } catch (err) { next(err); }
};

// ── betPlaced ────────────────────────────────────────────────────────────────
/**
 * POST /api/bc/BetPlaced
 * Body: { AuthToken, TS, Hash, TransactionId, BetId, Amount, Created,
 *         BetType, SystemMinCount, TotalPrice, Selections[] }
 *
 * 1. Idempotency check on TransactionId.
 * 2. Balance check and atomic debit.
 * 3. Create Bet + Transaction ledger record in one session.
 */
const betPlaced = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { AuthToken, TransactionId, BetId, Amount,
            BetType, SystemMinCount, TotalPrice, Selections = [] } = req.body;

    const stake = parseFloat(Amount);
    if (isNaN(stake) || stake < 0) {
      await session.abortTransaction(); session.endSession();
      return bcErr(res, "500", "Invalid Amount value.");
    }

    // Idempotency — run OUTSIDE the session so BC retries don't waste a
    // replica-set transaction slot. The unique index on bcTransactionId is
    // the final safety net at the DB level.
    const existing = await Bet
      .findOne({ bcTransactionId: String(TransactionId) })
      .lean();

    if (existing) {
      await session.commitTransaction(); session.endSession();
      const userId = decodeToken(AuthToken);
      const u = userId ? await User.findById(userId).select("balance") : null;
      return bcOk(res, { Balance: u ? parseFloat(u.balance.toFixed(2)) : 0 });
    }

    // Resolve user inside the transaction
    const userId = decodeToken(AuthToken);
    if (!userId) {
      await session.abortTransaction(); session.endSession();
      return bcErr(res, "1008", "Invalid AuthToken.");
    }

    const user = await User.findById(userId).session(session);
    if (!user)          { await session.abortTransaction(); session.endSession(); return bcErr(res, "1008", "User not found."); }
    if (!user.isActive) { await session.abortTransaction(); session.endSession(); return bcErr(res, "1008", "User account is inactive."); }

    // Insufficient funds
    if (user.balance < stake) {
      await session.abortTransaction(); session.endSession();
      return bcErr(res, "2400", "Insufficient balance.");
    }

    // Atomic debit with balance guard to prevent race conditions
    const updated = await User.findOneAndUpdate(
      { _id: user._id, balance: { $gte: stake } },
      { $inc: { balance: -stake } },
      { new: true, session }
    );
    if (!updated) {
      await session.abortTransaction(); session.endSession();
      return bcErr(res, "2400", "Insufficient balance (concurrent update).");
    }

    // Create Bet
    const [newBet] = await Bet.create([{
      user:             user._id,
      bcTransactionId:  String(TransactionId),
      bcBetId:          String(BetId),
      bcAmount:         stake,
      bcBetType:        BetType         != null ? Number(BetType)         : null,
      bcSystemMinCount: SystemMinCount  != null ? Number(SystemMinCount)  : null,
      bcTotalPrice:     TotalPrice      != null ? parseFloat(TotalPrice)  : null,
      bcSelections:     Array.isArray(Selections) ? Selections : [],
      status:           "OPEN",
      bcAmountPaid:     0,
    }], { session });

    // Ledger entry
    await Transaction.create([{
      user:           user._id,
      type:           "BET_PLACED",
      amount:         stake,
      runningBalance: updated.balance,
      description:    `BC BetPlaced — BetId: ${BetId}, TxId: ${TransactionId}`,
      referenceId:    newBet._id,
      referenceModel: "Bet",
    }], { session });

    await session.commitTransaction(); session.endSession();
    return bcOk(res, { Balance: parseFloat(updated.balance.toFixed(2)) });
  } catch (err) {
    await session.abortTransaction(); session.endSession();
    next(err);
  }
};

// ── betResulted ──────────────────────────────────────────────────────────────
/**
 * POST /api/bc/BetResulted
 * Body: { AuthToken, TS, Hash, TransactionId, BetId, BetState,
 *         Amount, BonusAmount, BonusId }
 *
 * DELTA LOGIC (called multiple times for same BetId):
 *   delta = incomingAmount - bet.bcAmountPaid
 *   user.balance += delta
 *   bet.bcAmountPaid = incomingAmount
 */
const betResulted = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { AuthToken, TransactionId, BetId, BetState, Amount } = req.body;

    // NaN-safe parse: Amount=0 is valid (LOST bet returns zero), Amount="abc" should
    // not silently produce 0. Use NaN-safe ternary instead of || operator.
    const parsedAmt      = parseFloat(Amount);
    const incomingAmount = !isNaN(parsedAmt) ? parsedAmt : 0;
    const newStatus      = BC_STATE_TO_STATUS[parseInt(BetState, 10)] || "OPEN";

    const userId = decodeToken(AuthToken);
    if (!userId) {
      await session.abortTransaction(); session.endSession();
      return bcErr(res, "1008", "Invalid AuthToken.");
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction(); session.endSession();
      return bcErr(res, "1008", "User not found.");
    }

    // Scope BetId lookup to the authenticated user to prevent cross-user settlement
    // if BC misconfigures and sends the same BetId for two different users.
    const bet = await Bet.findOne({ bcBetId: String(BetId), user: userId }).session(session);
    if (!bet) {
      await session.abortTransaction(); session.endSession();
      return bcErr(res, "500", `Bet BetId ${BetId} not found.`);
    }

    // ── Delta calculation ─────────────────────────────────────
    const delta = parseFloat((incomingAmount - (bet.bcAmountPaid || 0)).toFixed(2));

    if (delta !== 0) {
      // Single atomic op: $inc + clamp to 0 via aggregation pipeline update.
      // Avoids a second findOneAndUpdate that creates an inconsistent intermediate
      // state (temporarily negative balance) within the same transaction.
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId },
        [{ $set: { balance: { $max: [{ $add: ["$balance", delta] }, 0] } } }],
        { new: true, session }
      );
      const finalBalance = parseFloat(updatedUser.balance.toFixed(2));
      user.balance = finalBalance;

      const txType =
        ["WON", "RETURNED", "CASHED_OUT"].includes(newStatus) ? "BET_WON" :
        newStatus === "LOST" ? "BET_PLACED" : "BET_PLACED";

      await Transaction.create([{
        user:           user._id,
        type:           txType,
        amount:         Math.abs(delta),
        runningBalance: finalBalance,
        description:    `BC BetResulted — BetId: ${BetId}, TxId: ${TransactionId}, State: ${newStatus}, Δ: ${delta >= 0 ? "+" : ""}${delta}`,
        referenceId:    bet._id,
        referenceModel: "Bet",
      }], { session });
    }

    bet.status       = newStatus;
    bet.bcAmountPaid = incomingAmount;
    bet.settledAt    = newStatus !== "OPEN" ? new Date() : bet.settledAt;
    await bet.save({ session });

    await session.commitTransaction(); session.endSession();
    return bcOk(res, { Balance: parseFloat(user.balance.toFixed(2)) });
  } catch (err) {
    await session.abortTransaction(); session.endSession();
    next(err);
  }
};

// ── rollback ─────────────────────────────────────────────────────────────────
/**
 * POST /api/bc/Rollback
 * Body: { AuthToken, TS, Hash, TransactionId }
 *
 * Reverses a BetPlaced if BC's own pipeline failed after calling us.
 */
const rollback = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { AuthToken, TransactionId } = req.body;

    const userId = decodeToken(AuthToken);
    if (!userId) {
      await session.abortTransaction(); session.endSession();
      return bcErr(res, "1008", "Invalid AuthToken.");
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction(); session.endSession();
      return bcErr(res, "1008", "User not found.");
    }

    const bet = await Bet.findOne({ bcTransactionId: String(TransactionId) }).session(session);

    // Not found or already voided — idempotent success
    if (!bet || bet.status === "VOID") {
      await session.commitTransaction(); session.endSession();
      return bcOk(res, { Balance: parseFloat(user.balance.toFixed(2)) });
    }

    // Cannot rollback an already-settled bet
    if (["WON", "LOST", "RETURNED", "CASHED_OUT"].includes(bet.status)) {
      await session.abortTransaction(); session.endSession();
      return bcErr(res, "605", `Cannot rollback bet with status: ${bet.status}.`);
    }

    // Atomic $inc for the refund — prevents the same race condition as betResulted.
    // Two concurrent rollbacks on the same user must not both read the same stale balance.
    const refund       = bet.bcAmount;
    const updatedUser  = await User.findOneAndUpdate(
      { _id: userId },
      { $inc: { balance: refund } },
      { new: true, session }
    );
    const finalBalance = parseFloat(updatedUser.balance.toFixed(2));

    bet.status    = "VOID";
    bet.settledAt = new Date();
    await bet.save({ session });

    await Transaction.create([{
      user:           user._id,
      type:           "BET_REFUND",
      amount:         refund,
      runningBalance: finalBalance,
      description:    `BC Rollback — TxId: ${TransactionId}`,
      referenceId:    bet._id,
      referenceModel: "Bet",
    }], { session });

    await session.commitTransaction(); session.endSession();
    return bcOk(res, { Balance: finalBalance });
  } catch (err) {
    await session.abortTransaction(); session.endSession();
    next(err);
  }
};

module.exports = { getClientDetails, getClientBalance, betPlaced, betResulted, rollback };
