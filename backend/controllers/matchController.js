/**
 * @file controllers/matchController.js
 * @description Endpoints for fetching cached Betfair match data.
 *
 * Mounted at: /api/matches
 * These routes are accessible to all logged-in users (any tier).
 * All data in these responses is READ-ONLY and sourced from the
 * local MongoDB cache — never directly from Betfair's API.
 *
 * Endpoints:
 *   GET /api/matches           → listMatches  (sportsbook listing page)
 *   GET /api/matches/:id       → getMatch     (single match + full runner odds)
 */

"use strict";

const mongoose = require("mongoose");
const Match = require("../models/Match");

// ============================================================
// GET /api/matches
// ============================================================
/**
 * @desc  Returns a paginated, filterable list of matches from the local cache.
 *        Powers the main sportsbook listing page.
 * @access Private (any authenticated user)
 *
 * Query params:
 *   sport    {string}  Filter by sport name (e.g., "Cricket", "Soccer")
 *   status   {string}  'OPEN' | 'IN_PLAY' | 'SCHEDULED' | 'SETTLED' (default: OPEN,IN_PLAY)
 *   page     {number}  Page number (default: 1)
 *   limit    {number}  Results per page (default: 20, max: 50)
 */
const listMatches = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // ---- Build filter ----
    const filter = {};

    // Status filter — default shows active sportsbook markets
    const VALID_STATUSES = ["SCHEDULED", "OPEN", "IN_PLAY", "SUSPENDED", "SETTLED", "CLOSED"];
    if (req.query.status) {
      const statuses = req.query.status.split(",").map((s) => s.trim().toUpperCase());
      const validRequested = statuses.filter((s) => VALID_STATUSES.includes(s));
      if (validRequested.length > 0) {
        filter.status = { $in: validRequested };
      }
    } else {
      // Default: show live and upcoming markets only
      filter.status = { $in: ["OPEN", "IN_PLAY", "SCHEDULED"] };
    }

    // Sport filter
    if (req.query.sport) {
      // Case-insensitive prefix match, sanitised by express-mongo-sanitize
      filter.sport = { $regex: `^${req.query.sport}`, $options: "i" };
    }

    // ---- Query ----
    const [matches, total] = await Promise.all([
      Match.find(filter)
        .sort({ status: 1, startTime: 1 }) // IN_PLAY first (alphabetically before OPEN/SCHEDULED)
        .skip(skip)
        .limit(limit)
        .select("eventName sport startTime status runners betfairMarketId lastSyncedAt")
        .lean(),
      Match.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: matches,
    });
  } catch (err) {
    console.error("[listMatches]", err);
    return res.status(500).json({ error: "Failed to fetch matches." });
  }
};

// ============================================================
// GET /api/matches/:id
// ============================================================
/**
 * @desc  Returns a single match with full runner details and current odds.
 *        Used when a client opens a specific match to place a bet.
 * @access Private (any authenticated user)
 */
const getMatch = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid match ID." });
    }

    const match = await Match.findById(req.params.id).lean();

    if (!match) {
      return res.status(404).json({ error: "Match not found." });
    }

    // Include data-freshness indicator for the frontend
    const staleSecs = Math.floor((Date.now() - new Date(match.lastSyncedAt).getTime()) / 1000);

    return res.status(200).json({
      success: true,
      dataAgeSeconds: staleSecs,
      data: match,
    });
  } catch (err) {
    console.error("[getMatch]", err);
    return res.status(500).json({ error: "Failed to fetch match." });
  }
};

module.exports = { listMatches, getMatch };
