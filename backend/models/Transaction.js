/**
 * @file models/Transaction.js
 * @description The financial ledger for the Virtual Coin economy.
 *
 * Every coin movement that affects a user's balance is recorded here.
 * This powers three critical reports:
 *   1. Account Statement — chronological ledger of all events
 *   2. Profit & Loss     — aggregate of winnings vs. stakes
 *
 * "Running Balance" Pattern:
 *   Each document captures the user's balance AT THE TIME of the event.
 *   This makes reconstructing historical balances possible without
 *   replaying every transaction.
 *
 * Transaction Types:
 *   TRANSFER_IN   → Coins received from a MASTER
 *   TRANSFER_OUT  → Coins sent by a MASTER (from the master's perspective) — NOT used on client
 *   BET_PLACED    → Stake deducted from balance when bet is placed
 *   BET_WON       → Winnings credited to balance after settlement
 *   BET_REFUND    → Full stake returned (VOID bet settlement)
 *
 * externalTxId Field:
 *   Stores the BC-issued TransactionId for Casino API 3.1.4 operations.
 *   Sparse-indexed so null values (Sports bets, transfers) are excluded
 *   from the index, keeping it compact. Used as the primary idempotency
 *   key instead of a full-table $regex scan on `description`.
 */

"use strict";

const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    // ---- The user whose balance this transaction affected ----
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Transaction must be linked to a user."],
      index: true, // Indexed for fast per-user statement queries
    },

    // ---- Type of event ----
    type: {
      type: String,
      enum: {
        values: ["TRANSFER_IN", "TRANSFER_OUT", "BET_PLACED", "BET_WON", "BET_REFUND"],
        message: "Invalid transaction type.",
      },
      required: [true, "Transaction type is required."],
    },

    // ---- Coin amount for this event (always positive) ----
    // For debits (BET_PLACED, TRANSFER_OUT), amount is positive but
    // the application layer knows to subtract it. Store as absolute value.
    amount: {
      type: Number,
      required: [true, "Transaction amount is required."],
      min: [0.01, "Transaction amount must be positive."],
    },

    // ---- Balance snapshot after this transaction was applied ----
    // Allows instant balance reconstruction at any point in time.
    runningBalance: {
      type: Number,
      required: [true, "Running balance is required."],
      min: 0,
    },

    // ---- Human-readable description ----
    // e.g. "Bet placed on Arsenal @ 2.40", "Transfer from master_eu"
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters."],
    },

    // ---- Polymorphic reference to the source document ----
    // For BET_PLACED / BET_WON / BET_REFUND: references the Bet document.
    // For TRANSFER_IN / TRANSFER_OUT: references the other User document.
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      // refPath is avoided intentionally because we populate manually
      // to keep the model clean and avoid circular dependencies.
    },

    // ---- Reference model hint (for manual population) ----
    referenceModel: {
      type:    String,
      enum:    ["Bet", "User", "Casino", null],
      default: null,
    },

    // ---- External transaction identifier (Casino API 3.1.4 idempotency) ----
    // Stores BC's TransactionId for Deposit, Withdraw, and Rollback calls.
    // Sparse index: only Casino transactions carry this value, so null entries
    // (Sports bets, transfers) are excluded from the index — keeps it small.
    // Used instead of a $regex scan on `description` for O(log n) lookups.
    externalTxId: {
      type:   String,
      unique: true,   // C-1 FIX: enforce idempotency at DB level; prevents double-processing on BC retries
      index:  true,
      sparse: true,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt used as the primary sort key for statements
  }
);

// ---- Compound Index: fast date-range queries per user ----
transactionSchema.index({ user: 1, createdAt: -1 });

// ---- Compound Index: fast P&L aggregation by type + date ----
transactionSchema.index({ user: 1, type: 1, createdAt: -1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
