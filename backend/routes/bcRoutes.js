/**
 * @file routes/bcRoutes.js
 * @description BetConstruct Partner API v0.40 — Routes & Security Middleware
 *
 * ============================================================
 * SECURITY CHAIN (applied in order on every request)
 * ============================================================
 * 1. verifyBcIp      → IP whitelist (skipped in development)
 * 2. verifyBcRequest → TS timestamp + MD5 Hash verification
 * 3. Controller      → Business logic
 *
 * Mount in server.js:
 *   app.use('/api/bc', require('./routes/bcRoutes'));
 *
 * ============================================================
 * IP WHITELIST
 * ============================================================
 * Set BC_WHITELISTED_IPS in .env as comma-separated IPs:
 *   BC_WHITELISTED_IPS=1.2.3.4,5.6.7.8
 *
 * The check is auto-bypassed when NODE_ENV=development.
 * NEVER disable in production.
 *
 * ============================================================
 * ERROR CODE 1700
 * ============================================================
 * Per BC spec, hash mismatches return ErrorCode 1700
 * ("API wrong access exception").
 */

"use strict";

const express = require("express");
const router  = express.Router();

const { verifyHash, verifyTimestamp, HASH_PARAM_ORDERS } = require("../services/bcSecurity");
const { getClientDetails, getClientBalance, betPlaced, betResulted, rollback } =
  require("../controllers/bcPartnerController");

// ── MIDDLEWARE 1: IP Whitelist ────────────────────────────────────────────────

const verifyBcIp = (req, res, next) => {
  if (process.env.NODE_ENV === "development") return next();

  const allowedIps = (process.env.BC_WHITELISTED_IPS || "")
    .split(",").map((ip) => ip.trim()).filter(Boolean);

  const clientIp =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress;

  if (!allowedIps.includes(clientIp)) {
    return res.status(200).json({
      ErrorCode: "1008",
      ErrorText: `Forbidden. IP not whitelisted: ${clientIp}`,
    });
  }
  next();
};

// ── MIDDLEWARE 2: Timestamp + Hash Verification ───────────────────────────────
/**
 * Factory: returns a middleware specific to each endpoint's hash parameter order.
 * @param {string} endpointName - Key in HASH_PARAM_ORDERS (e.g. "BetPlaced")
 */
const verifyBcRequest = (endpointName) => (req, res, next) => {
  const sharedKey = process.env.BC_SHARED_KEY;
  if (!sharedKey) {
    console.error("[BC Security] BC_SHARED_KEY is not configured.");
    return res.status(200).json({ ErrorCode: "500", ErrorText: "Server misconfiguration." });
  }

  // 1. Timestamp check
  const tsResult = verifyTimestamp(req.body.TS);
  if (!tsResult.valid) {
    return res.status(200).json({
      ErrorCode: "1700",
      ErrorText: `Timestamp rejected: ${tsResult.message}`,
    });
  }

  // 2. Hash check
  const paramOrder = HASH_PARAM_ORDERS[endpointName];
  if (!paramOrder) {
    return res.status(200).json({
      ErrorCode: "500",
      ErrorText: `No hash order defined for: ${endpointName}`,
    });
  }

  if (!verifyHash(req.body, paramOrder, sharedKey)) {
    return res.status(200).json({
      ErrorCode: "1700",
      ErrorText:  "API wrong access exception. Hash verification failed.",
    });
  }

  next();
};

// ── ROUTES ────────────────────────────────────────────────────────────────────

router.post("/GetClientDetails",
  verifyBcIp, verifyBcRequest("GetClientDetails"), getClientDetails);

router.post("/GetClientBalance",
  verifyBcIp, verifyBcRequest("GetClientBalance"), getClientBalance);

router.post("/BetPlaced",
  verifyBcIp, verifyBcRequest("BetPlaced"), betPlaced);

router.post("/BetResulted",
  verifyBcIp, verifyBcRequest("BetResulted"), betResulted);

router.post("/Rollback",
  verifyBcIp, verifyBcRequest("Rollback"), rollback);

module.exports = router;
