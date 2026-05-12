/**
 * @file models/Bet.js
 * @description Mongoose schema for recording BetConstruct-managed bets.
 *
 * ============================================================
 * ARCHITECTURE: PROVIDER MODEL (BetConstruct AGP)
 * ============================================================
 * In the new architecture, BetConstruct (BC) owns the entire
 * betting UI (match listing, bet slip) via an embedded iFrame.
 * Our backend is a passive "wallet API" — BC calls us.
 *
 * Bet Lifecycle:
 *   1. User places a bet in BC iFrame.
 *   2. BC backend → POST /api/bc/BetPlaced
 *      We verify balance, debit, and create this Bet document.
 *      Status: OPEN
 *   3. Match concludes. BC backend → POST /api/bc/BetResulted
 *      BetState indicates outcome. We credit the delta amount.
 *      Status: WON | LOST | RETURNED | CASHED_OUT
 *   4. If BC's placement fails after calling us:
 *      BC backend → POST /api/bc/Rollback
 *      We refund the stake. Status: VOID
 *
 * ============================================================
 * BETRESULTED DELTA PATTERN
 * ============================================================
 * BetConstruct may call BetResulted multiple times for the same
 * BetId (e.g., corrections, partial cash-outs). To prevent
 * double-crediting, we track `bcAmountPaid` — the cumulative
 * total credited so far — and only apply the delta:
 *
 *   delta = incomingAmount - bcAmountPaid
 *   user.balance += delta
 *   bet.bcAmountPaid = incomingAmount
 *
 * ============================================================
 * BALANCE ATOMICITY
 * ============================================================
 * All balance mutations use Mongoose sessions (MongoDB ACID
 * transactions) to prevent race conditions.
 * Requires a MongoDB replica set (Atlas M10+, or local rs).
 */

"use strict";

const mongoose = require("mongoose");

// ---- BetConstruct BetState mapping (from Partner API v0.40) ----
// 1 = Accepted  (open, in-play)
// 2 = Returned  (void/refund — stake returned)
// 3 = Lost
// 4 = Won
// 5 = Cashed-out
const BC_BET_STATE = Object.freeze({ ACCEPTED: 1, RETURNED: 2, LOST: 3, WON: 4, CASHED_OUT: 5 });

// ---- Sub-schema for individual bet selections sent by BC ----
const selectionSchema = new mongoose.Schema(
  {
    // BC's unique identifier for the specific selection (outcome)
    Id: { type: Number, default: null },
    // The event/sport name  
    EventId: { type: Number, default: null },
    EventName: { type: String, default: null },
    // The market (match-winner, over/under, etc.)
    MarketId: { type: Number, default: null },
    MarketName: { type: String, default: null },
    // The specific outcome chosen (team, player, etc.)
    RunnerId: { type: Number, default: null },
    RunnerName: { type: String, default: null },
    // Decimal odds at the time of placement
    Odds: { type: Number, default: null },
  },
  { _id: false }
);

const betSchema = new mongoose.Schema(
  {
    // ---- Internal Relationship ----
    // The platform user who placed this bet.
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "A bet must belong to a user."],
      index:    true,
    },

    // ---- BetConstruct Core Identifiers ----

    // BC's unique transaction identifier for this placement operation.
    // This is our PRIMARY IDEMPOTENCY KEY — used to reject duplicate BetPlaced calls.
    // Stored as String to safely handle BC's large integer values (avoid JS precision issues).
    bcTransactionId: {
      type:     String,
      required: [true, "BC TransactionId is required."],
      unique:   true,
      index:    true,
    },

    // BC's unique bet identifier. Used as the lookup key in BetResulted and Rollback.
    // A single BetId can be associated with multiple TransactionIds (e.g., partial cash-outs).
    bcBetId: {
      type:     String,
      required: [true, "BC BetId is required."],
      index:    true,
    },

    // ---- Financial Details ----

    // The original stake amount sent by BC in BetPlaced. Stored for Rollback refund calculation.
    bcAmount: {
      type:    Number,
      required: [true, "BC Amount (stake) is required."],
      min:     [0, "Amount must be non-negative."],
    },

    // ---- BetConstruct Metadata ----

    // BC's bet type code (e.g., 1 = Single, 2 = Accumulator, etc.).
    bcBetType: {
      type:    Number,
      default: null,
    },

    // The combined/system total price (decimal odds) for the entire bet slip.
    bcTotalPrice: {
      type:    Number,
      default: null,
    },

    // For system bets: the minimum number of selections that must win.
    bcSystemMinCount: {
      type:    Number,
      default: null,
    },

    // ISO 4217 currency code used by BC for this bet (stored for audit).
    // Our internal economy uses virtual coins; this is informational only.
    bcCurrency: {
      type:    String,
      default: null,
    },

    // The raw Selections array sent by BC in BetPlaced.
    // Stored verbatim for auditability and future reconciliation.
    bcSelections: {
      type:    [selectionSchema],
      default: [],
    },

    // ---- Settlement / Delta Tracking ----

    // Cumulative total amount credited to the user across ALL BetResulted calls for this BetId.
    // Used to compute the delta on repeated calls (correction / partial cash-out flow).
    // See BETRESULTED DELTA PATTERN in the header comment.
    bcAmountPaid: {
      type:    Number,
      default: 0,
      min:     [0, "bcAmountPaid cannot be negative."],
    },

    // ---- Bet Status ----
    // Maps to BetConstruct BetState values + internal OPEN/VOID states.
    status: {
      type: String,
      enum: {
        values:  ["OPEN", "WON", "LOST", "RETURNED", "CASHED_OUT", "VOID"],
        message: "status must be OPEN, WON, LOST, RETURNED, CASHED_OUT, or VOID.",
      },
      default: "OPEN",
      index:   true,
    },

    // Timestamp when status moved away from OPEN. Null while still open.
    settledAt: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt = placement time, updatedAt = last settlement attempt
  }
);

// ---- Compound index for common BetResulted/Rollback lookups ----
betSchema.index({ bcBetId: 1, status: 1 });
betSchema.index({ user: 1, status: 1, createdAt: -1 });

// ---- Export the BetState constants for use in the controller ----
betSchema.statics.BC_BET_STATE = BC_BET_STATE;

const Bet = mongoose.model("Bet", betSchema);

module.exports = Bet;
