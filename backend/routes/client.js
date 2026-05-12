/**
 * @file routes/client.js
 * @description Express router for all CLIENT-tier API endpoints.
 *
 * All routes require:
 *   1. A valid JWT (protect middleware)
 *   2. The caller to be a CLIENT account (authorize middleware)
 *
 * Mounted at: /api/client
 */

"use strict";

const express = require("express");
const router = express.Router();

const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getStatement,
  getProfitLoss,
  getBetHistory,
  getUnsettledBets,
  updateStakePreferences,
  changePassword,
} = require("../controllers/clientController");

// Apply auth to ALL routes in this router
// Only CLIENT accounts can call these endpoints
router.use(protect, restrictTo("CLIENT"));

// ── Reports ────────────────────────────────────────────────────────────────────

// GET /api/client/statement?page=1&limit=20&startDate=2026-01-01&endDate=2026-04-08
router.get("/statement", getStatement);

// GET /api/client/profit-loss?startDate=2026-01-01&endDate=2026-04-08
router.get("/profit-loss", getProfitLoss);

// ── Bets ───────────────────────────────────────────────────────────────────────

// GET /api/client/bets/history?status=WON&page=1&limit=20
router.get("/bets/history", getBetHistory);

// GET /api/client/bets/unsettled
router.get("/bets/unsettled", getUnsettledBets);

// ── Preferences ────────────────────────────────────────────────────────────────

// PUT /api/client/preferences/stakes  body: { stakes: [100, 500, 1000, 5000] }
router.put("/preferences/stakes", updateStakePreferences);

// ── Security ────────────────────────────────────────────────────────────────────

// PUT /api/client/password  body: { currentPassword, newPassword }
router.put("/password", changePassword);

module.exports = router;
