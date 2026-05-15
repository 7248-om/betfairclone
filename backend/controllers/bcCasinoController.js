/**
 * @file controllers/bcCasinoController.js
 * @description BetConstruct Casino Integration API 3.1.4 — Webhook Handlers
 *
 * ============================================================
 * ARCHITECTURE
 * ============================================================
 * This controller mirrors the Sports Partner Controller but follows the
 * Casino Integration API 3.1.4 response schema, which differs from v0.40:
 *
 *   Sports (v0.40):  { ErrorCode, ErrorText, Balance, ... }
 *   Casino (3.1.4):  { ResponseCode, Description, Data: { ... } }
 *
 * BetConstruct's Casino backend calls these endpoints as part of the
 * player Wallet API:
 *   POST /api/casino/GetBalance  — Return the player's current balance.
 *   POST /api/casino/Deposit     — Credit the player (win / bonus).
 *   POST /api/casino/Withdraw    — Debit the player (bet placement).
 *   POST /api/casino/Rollback    — Reverse a Deposit or Withdraw.
 *
 * ============================================================
 * RESPONSE CONTRACT (Casino Integration API 3.1.4)
 * ============================================================
 * All responses are HTTP 200. Business errors use ResponseCode values:
 *
 *   ResponseCode  | Meaning
 *   ─────────────────────────────────────────────────────────
 *   0             | Success
 *   1             | User not found / invalid token
 *   2             | Insufficient funds (Withdraw only)
 *   3             | Transaction already exists (Idempotent)
 *   4             | Transaction not found (Rollback only)
 *   5             | Internal error
 *   1700          | Hash / authentication failure (returned by middleware)
 *
 * The `Data` object shape differs per endpoint — see individual handler docs.
 *
 * ============================================================
 * AUTHENTICATION
 * ============================================================
 * BC sends `Token` in the request body. This is the JWT we issued at login.
 * We decode it with JWT_SECRET to retrieve the user _id, identical to the
 * Sports Partner controller pattern.
 *
 * ============================================================
 * ATOMICITY
 * ============================================================
 * Deposit, Withdraw, and Rollback all use Mongoose sessions (MongoDB ACID
 * transactions). Requires a MongoDB replica set (Atlas M10+ or local rs).
 *
 * ============================================================
 * IDEMPOTENCY KEY
 * ============================================================
 * BC sends `TransactionId` (a unique numeric string) with every Deposit,
 * Withdraw, and Rollback call. We store this on the Bet/Transaction document
 * and reject (returning ResponseCode 3) any duplicate TransactionId to
 * prevent double-credits or double-debits on BC retries.
 */

"use strict";

const mongoose    = require("mongoose");
const jwt         = require("jsonwebtoken");
const User        = require("../models/User");
const Transaction = require("../models/Transaction");

// ── Response helpers ─────────────────────────────────────────────────────────

/**
 * Send a Casino API 3.1.4 compliant response.
 * Always HTTP 200 — BC spec requirement for business errors.
 *
 * @param {Object}        res          - Express response
 * @param {number|string} code         - ResponseCode (0 = success)
 * @param {string}        description  - Human-readable message
 * @param {Object}        [data]       - Endpoint-specific payload
 */
const casinoReply = (res, code, description, data = {}) =>
  res.status(200).json({
    ResponseCode: Number(code),
    Description:  description,
    Data:         data,
  });

const casinoOk  = (res, data = {})          => casinoReply(res, 0, "Success", data);
const casinoErr = (res, code, description)  => casinoReply(res, code, description);

// ── Decode JWT Token ─────────────────────────────────────────────────────────

/**
 * Extracts the MongoDB user _id from the JWT `Token` field BC sends.
 * Returns null if the token is missing, expired, or malformed.
 *
 * @param {string} token - JWT sent by BC in request body as `Token`.
 * @returns {string|null} MongoDB ObjectId string, or null.
 */
const decodeToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET).id;
  } catch {
    return null;
  }
};

// ── GetBalance ───────────────────────────────────────────────────────────────
/**
 * POST /api/casino/GetBalance
 *
 * BC calls this before launching a game to show the player's current balance.
 *
 * Request body (Casino API 3.1.4):
 * {
 *   Token:         string   ← player's JWT
 *   PartnerId:     number
 *   GameId:        string   ← (optional) game about to be launched
 *   Currency:      string
 *   PublicKey:     string   ← SHA256 hash (verified by middleware)
 * }
 *
 * Success Data: { Balance: number }
 */
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
/**
 * POST /api/casino/Deposit
 *
 * BC calls this to credit the player (win, bonus payout, refund).
 *
 * Request body:
 * {
 *   Token:          string
 *   PartnerId:      number
 *   TransactionId:  string   ← idempotency key
 *   Amount:         number   ← amount to CREDIT
 *   Currency:       string
 *   GameId:         string   ← (optional)
 *   RoundId:        string   ← (optional) links to a game round
 *   IsBonus:        boolean  ← (optional) bonus money flag
 *   PublicKey:      string
 * }
 *
 * Success Data: { Balance: number, TransactionId: string }
 */
const deposit = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { Token, TransactionId, Amount, GameId, RoundId } = req.body;
    const credit = parseFloat(Amount);

    if (isNaN(credit) || credit < 0) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 5, "Invalid Amount value.");
    }

    // ── Idempotency ───────────────────────────────────────────
    // If this TransactionId was already processed, return success immediately
    // with the current balance so BC does not retry indefinitely.
    const existing = await Transaction.findOne({
      description: { $regex: `Casino:Deposit:${TransactionId}` },
    }).lean();

    if (existing) {
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
    if (!user.isActive) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 1, "User account is inactive.");
    }

    // ── Credit balance ────────────────────────────────────────
    user.balance = parseFloat((user.balance + credit).toFixed(2));
    await user.save({ session });

    // ── Ledger entry ──────────────────────────────────────────
    await Transaction.create([{
      user:           user._id,
      type:           "BET_WON",
      amount:         credit,
      runningBalance: user.balance,
      description:    `Casino:Deposit:${TransactionId}${GameId ? `:Game:${GameId}` : ""}${RoundId ? `:Round:${RoundId}` : ""}`,
      referenceModel: "Casino",
    }], { session });

    await session.commitTransaction(); session.endSession();
    return casinoOk(res, {
      Balance:       parseFloat(user.balance.toFixed(2)),
      TransactionId: String(TransactionId),
    });
  } catch (err) {
    await session.abortTransaction(); session.endSession();
    next(err);
  }
};

// ── Withdraw ─────────────────────────────────────────────────────────────────
/**
 * POST /api/casino/Withdraw
 *
 * BC calls this to debit the player (bet placement, ante bet).
 *
 * Request body:
 * {
 *   Token:          string
 *   PartnerId:      number
 *   TransactionId:  string   ← idempotency key
 *   Amount:         number   ← amount to DEBIT
 *   Currency:       string
 *   GameId:         string
 *   RoundId:        string
 *   PublicKey:      string
 * }
 *
 * Success Data: { Balance: number, TransactionId: string }
 */
const withdraw = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { Token, TransactionId, Amount, GameId, RoundId } = req.body;
    const debit = parseFloat(Amount);

    if (isNaN(debit) || debit < 0) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 5, "Invalid Amount value.");
    }

    // ── Idempotency ───────────────────────────────────────────
    const existing = await Transaction.findOne({
      description: { $regex: `Casino:Withdraw:${TransactionId}` },
    }).lean();

    if (existing) {
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
    if (!user.isActive) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 1, "User account is inactive.");
    }

    // ── Insufficient funds ────────────────────────────────────
    if (user.balance < debit) {
      await session.abortTransaction(); session.endSession();
      return casinoErr(res, 2, "Insufficient balance.");
    }

    // ── Atomic debit with balance guard ───────────────────────
    // findOneAndUpdate with $gte guard prevents race conditions between
    // concurrent Withdraw calls (e.g., two games played simultaneously).
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
      runningBalance: updated.balance,
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
};

// ── Rollback ─────────────────────────────────────────────────────────────────
/**
 * POST /api/casino/Rollback
 *
 * BC calls this to reverse a Withdraw or Deposit when a game round is
 * cancelled, network-failed, or timed out on BC's side.
 *
 * Request body:
 * {
 *   Token:                  string
 *   PartnerId:              number
 *   TransactionId:          string   ← TransactionId of the Withdraw/Deposit to reverse
 *   RelatedTransactionId:   string   ← original TransactionId being rolled back
 *   Amount:                 number   ← amount originally debited/credited
 *   Currency:               string
 *   GameId:                 string
 *   RoundId:                string
 *   PublicKey:              string
 * }
 *
 * Success Data: { Balance: number, TransactionId: string }
 */
const rollback = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      Token,
      TransactionId,          // The new rollback transaction ID (idempotency)
      RelatedTransactionId,   // The original Withdraw/Deposit being reversed
      Amount,
      GameId,
      RoundId,
    } = req.body;

    // ── Idempotency ───────────────────────────────────────────
    // If we've already processed this Rollback TransactionId, return success.
    const alreadyRolled = await Transaction.findOne({
      description: { $regex: `Casino:Rollback:${TransactionId}` },
    }).lean();

    if (alreadyRolled) {
      await session.commitTransaction(); session.endSession();
      const userId = decodeToken(Token);
      const u = userId ? await User.findById(userId).select("balance") : null;
      return casinoOk(res, {
        Balance:       u ? parseFloat(u.balance.toFixed(2)) : 0,
        TransactionId: String(TransactionId),
      });
    }

    // ── Find the original transaction ─────────────────────────
    const originalTx = await Transaction.findOne({
      description: {
        $regex: `Casino:(Withdraw|Deposit):${RelatedTransactionId}`,
      },
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
    // If the original was a Withdraw (BET_PLACED), we refund → credit.
    // If the original was a Deposit  (BET_WON),   we reverse → debit.
    const isWithdrawRollback = originalTx.type === "BET_PLACED";
    const refundAmount       = parseFloat(Amount) || originalTx.amount;

    if (isWithdrawRollback) {
      user.balance = parseFloat((user.balance + refundAmount).toFixed(2));
    } else {
      // Deduct the bonus/win that was incorrectly credited. Guard vs negatives.
      user.balance = Math.max(0, parseFloat((user.balance - refundAmount).toFixed(2)));
    }
    await user.save({ session });

    // ── Ledger entry ──────────────────────────────────────────
    await Transaction.create([{
      user:           user._id,
      type:           isWithdrawRollback ? "BET_REFUND" : "BET_PLACED",
      amount:         refundAmount,
      runningBalance: user.balance,
      description:    `Casino:Rollback:${TransactionId}:Related:${RelatedTransactionId}${GameId ? `:Game:${GameId}` : ""}${RoundId ? `:Round:${RoundId}` : ""}`,
      referenceModel: "Casino",
    }], { session });

    await session.commitTransaction(); session.endSession();
    return casinoOk(res, {
      Balance:       parseFloat(user.balance.toFixed(2)),
      TransactionId: String(TransactionId),
    });
  } catch (err) {
    await session.abortTransaction(); session.endSession();
    next(err);
  }
};

module.exports = { getBalance, deposit, withdraw, rollback };
