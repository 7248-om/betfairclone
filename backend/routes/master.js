/**
 * @file routes/master.js
 * @description Express router for MASTER (and MAIN) tier management endpoints.
 */

"use strict";

const express = require("express");
const router = express.Router();

const { protect, restrictTo } = require("../middleware/authMiddleware");
const { verifyDownlineAccess } = require("../middleware/hierarchyMiddleware");

const {
  getMyClients,
  getClientStatement,
  getClientProfitLoss,
  getClientBets,
  transferCoins,
} = require("../controllers/masterController");

// Apply auth to ALL routes — both MASTER and MAIN may call these
router.use(protect, restrictTo("MASTER", "MAIN"));

// GET /api/master/clients — returns a list of the master's configured clients
router.get("/clients", getMyClients);

// POST /api/master/transfer — transfers coins to a client
router.post("/transfer", transferCoins);

// Apply the downline access verification to the specific client routes
router.use("/client/:clientId", verifyDownlineAccess);

// ── Client Reports ─────────────────────────────────────────────────────────────

router.get("/client/:clientId/statement", getClientStatement);
router.get("/client/:clientId/profit-loss", getClientProfitLoss);
router.get("/client/:clientId/bets", getClientBets);

module.exports = router;
