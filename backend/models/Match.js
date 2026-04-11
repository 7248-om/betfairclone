/**
 * @file models/Match.js
 * @description Mongoose schema for cached Betfair match/event data.
 *
 * ============================================================
 * PURPOSE: EXTERNAL DATA CACHE (READ-ONLY SPORTSBOOK)
 * ============================================================
 * This model is the bridge between the EXTERNAL Betfair API world
 * and the INTERNAL virtual coin economy.
 *
 * Matches are NOT created by users. They are fetched periodically
 * from the Betfair API by the server-side `services/betfairProxy.js`
 * and stored here as a local cache.
 *
 * This approach:
 *   1. Reduces API call frequency (respects Betfair rate limits).
 *   2. Allows the frontend to query our own fast MongoDB instead of
 *      an external API on every page load.
 *   3. Keeps the Betfair API credentials 100% server-side.
 *
 * The `betfairEventId` is the key that links our local bets (Bet model)
 * to the real-world event outcomes returned by Betfair.
 */

"use strict";

const mongoose = require("mongoose");

// -- Sub-schema for individual runner/team odds --
const runnerSchema = new mongoose.Schema(
  {
    runnerId: {
      type: String,
      required: true,
    },
    runnerName: {
      type: String,
      required: true,
    },
    // Back odds (probability of this runner winning, in decimal format)
    // e.g., 2.5 means "bet 1 coin, win 2.5 coins"
    backOdds: {
      type: Number,
      default: null,
    },
    // Lay odds (probability of this runner losing — for exchange markets)
    layOdds: {
      type: Number,
      default: null,
    },
  },
  { _id: false } // No separate ID needed for sub-documents
);

const matchSchema = new mongoose.Schema(
  {
    // ---- Betfair Source Identifiers ----
    // These IDs come directly from the Betfair API response.
    betfairEventId: {
      type: String,
      required: [true, "Betfair Event ID is required."],
      unique: true,
      index: true, // Indexed for fast lookups when syncing
    },
    betfairMarketId: {
      type: String,
      required: [true, "Betfair Market ID is required."],
      index: true,
    },

    // ---- Match Details (Sourced from Betfair) ----
    eventName: {
      type: String,
      required: true,
      trim: true,
    },
    // e.g., "Soccer", "Tennis", "Horse Racing"
    sport: {
      type: String,
      required: true,
      trim: true,
    },
    // The teams, players, or participants in this match
    // Stored as the `runners` subdocument array above
    runners: [runnerSchema],

    // When the event is scheduled to start (from Betfair, in UTC)
    startTime: {
      type: Date,
      required: true,
    },

    // ---- Match Lifecycle Status ----
    status: {
      type: String,
      enum: ["SCHEDULED", "OPEN", "IN_PLAY", "SUSPENDED", "SETTLED", "CLOSED"],
      default: "SCHEDULED",
      index: true, // Indexed for efficient filtering on the sportsbook page
    },

    // The declared winner after the match is settled.
    // This is populated by the Betfair sync job upon settlement.
    // The value should match one of the `runners[].runnerId` values.
    winnerRunnerId: {
      type: String,
      default: null,
    },

    // ---- Cache Metadata ----
    // Timestamp of the last time this record was synced from Betfair.
    // Used by the proxy service to decide if data is stale.
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

const Match = mongoose.model("Match", matchSchema);

module.exports = Match;
