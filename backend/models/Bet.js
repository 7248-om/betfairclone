/**
 * @file models/Bet.js
 * @description Mongoose schema for recording virtual coin bets.
 *
 * ============================================================
 * PURPOSE: THE INTERNAL VIRTUAL ECONOMY RECORD
 * ============================================================
 * A Bet document is created whenever a CLIENT places a bet on a Match.
 *
 * The lifecycle of a bet:
 *   1. CLIENT places a bet → status is 'OPEN', their balance is debited.
 *   2. The Betfair sync job settles the match → `services/settlementService.js`
 *      (to be built) reads the `winnerRunnerId` from the Match document.
 *   3. All OPEN bets for that match are evaluated:
 *      - If the bet's `selectedRunnerId` === match's `winnerRunnerId` → 'WON'
 *        → CLIENT's balance is credited with `potentialPayout`.
 *      - Otherwise → 'LOST'. No balance change.
 *      - If the market is voided by Betfair → 'VOID'
 *        → CLIENT's `stake` is refunded.
 *
 * ============================================================
 * IMPORTANT: BALANCE ATOMICITY
 * ============================================================
 * Balance deductions (on bet placement) and credits (on settlement) should
 * be performed using MongoDB transactions where possible to prevent race
 * conditions. Use mongoose sessions for this in the route handler.
 */

"use strict";

const mongoose = require("mongoose");

const betSchema = new mongoose.Schema(
  {
    // ---- Relationships ----
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "A bet must belong to a user."],
      index: true, // Indexed for fast "get all bets for user X" queries
    },
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: [true, "A bet must be associated with a match."],
      index: true, // Indexed for fast "get all bets for match Y" queries (settlement)
    },

    // ---- Bet Selection ----
    // The runner (team/player) the user has backed to win.
    // This `runnerId` must match one of the runners in the associated Match document.
    selectedRunnerId: {
      type: String,
      required: [true, "A runner/selection must be chosen."],
    },
    selectedRunnerName: {
      type: String,
      required: true, // Denormalized for fast display without a join
    },

    // ---- Financial Details (in Virtual Coins) ----
    // The number of virtual coins wagered by the CLIENT.
    stake: {
      type: Number,
      required: [true, "Stake amount is required."],
      min: [1, "Minimum stake is 1 coin."],
    },

    // The decimal odds at the time the bet was placed.
    // Stored here because market odds fluctuate; we lock them in at placement.
    oddsAtPlacement: {
      type: Number,
      required: [true, "Odds at the time of placement are required."],
      min: [1.01, "Odds must be greater than 1."],
    },

    // The virtual coin amount the user would receive if they win.
    // Calculated at bet placement: potentialPayout = stake * oddsAtPlacement
    // Stored for fast display; avoids recalculation on every query.
    potentialPayout: {
      type: Number,
      required: true,
    },

    // ---- Bet Status ----
    status: {
      type: String,
      enum: {
        values: ["OPEN", "WON", "LOST", "VOID"],
        message: "Bet status must be OPEN, WON, LOST, or VOID.",
      },
      default: "OPEN",
      index: true,
    },

    // Timestamp when this bet was settled (status changed from OPEN).
    // Null while the bet is still open.
    settledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt (bet placement time) and updatedAt
  }
);

// ============================================================
// PRE-SAVE HOOK: Auto-calculate potentialPayout
// ============================================================
// This ensures potentialPayout is always consistent with stake and oddsAtPlacement.
// It runs before every new bet is saved.
betSchema.pre("save", function (next) {
  if (this.isNew) {
    this.potentialPayout = parseFloat(
      (this.stake * this.oddsAtPlacement).toFixed(2)
    );
  }
  next();
});

const Bet = mongoose.model("Bet", betSchema);

module.exports = Bet;
