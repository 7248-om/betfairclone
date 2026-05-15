/**
 * @file routes/bcCasinoRoutes.js
 * @description BetConstruct Casino Integration API 3.1.4 — Routes & Security Middleware
 *
 * ============================================================
 * HOW CASINO AUTHENTICATION DIFFERS FROM SPORTS (v0.40)
 * ============================================================
 *
 *   Sports Partner API v0.40:
 *     Hash = MD5( paramValue1 + paramValue2 + ... + SharedKey )
 *     Sent in request body as `Hash`
 *
 *   Casino Integration API 3.1.4:
 *     PublicKey = SHA256( RawJsonBody + CasinoSharedKey )
 *     Sent in request body as `PublicKey`
 *
 * The critical difference is that the Casino hash covers the ENTIRE raw
 * JSON body (byte-for-byte, in the exact order BC serialised it), not
 * selected parameter values. This is why we capture req.rawBody via the
 * express.json verify callback in server.js.
 *
 * ============================================================
 * SECURITY CHAIN (applied in order)
 * ============================================================
 * 1. verifyCasinoIp   → IP whitelist check (same IPs as Sports, or a
 *                        dedicated Casino IP list — see BC back-office).
 *                        Bypassed in development.
 * 2. verifyCasinoRequest → SHA256 PublicKey verification.
 * 3. Controller        → Business logic.
 *
 * ============================================================
 * ENDPOINT MAP
 * ============================================================
 * POST /api/casino/GetBalance  → getBalance
 * POST /api/casino/Deposit     → deposit
 * POST /api/casino/Withdraw    → withdraw
 * POST /api/casino/Rollback    → rollback
 *
 * ============================================================
 * ENVIRONMENT VARIABLES REQUIRED
 * ============================================================
 * BC_CASINO_SHARED_KEY   — Shared key from BC Casino back-office.
 *                          DIFFERENT from BC_SHARED_KEY used by Sports.
 * BC_CASINO_WHITELISTED_IPS — Comma-separated IPs (optional override;
 *                          falls back to BC_WHITELISTED_IPS if not set).
 */

"use strict";

const express = require("express");
const router  = express.Router();

const { verifyCasinoHash } = require("../services/bcSecurity");
const { getBalance, deposit, withdraw, rollback } =
  require("../controllers/bcCasinoController");

// ── MIDDLEWARE 1: IP Whitelist ────────────────────────────────────────────────

const verifyCasinoIp = (req, res, next) => {
  // Bypass in development so engineers can test locally without VPN/proxy.
  if (process.env.NODE_ENV === "development") return next();

  // Casino IPs can be configured separately from Sports IPs in the BC back-office.
  // Fall back to the general sports whitelist if no casino-specific list is set.
  const rawList =
    process.env.BC_CASINO_WHITELISTED_IPS ||
    process.env.BC_WHITELISTED_IPS ||
    "";

  const allowedIps = rawList
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  const clientIp =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress;

  if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
    return res.status(200).json({
      ResponseCode: 1700,
      Description:  `Forbidden. IP not whitelisted: ${clientIp}`,
      Data:         {},
    });
  }

  next();
};

// ── MIDDLEWARE 2: SHA256 PublicKey Verification ───────────────────────────────

/**
 * Validates the BetConstruct Casino API request by:
 *   1. Confirming req.rawBody was captured (i.e., the express.json
 *      verify callback in server.js ran correctly).
 *   2. Extracting the `PublicKey` field from the parsed request body.
 *   3. Recomputing SHA256(rawBody + BC_CASINO_SHARED_KEY) and comparing
 *      it to the received PublicKey.
 *
 * Returns ResponseCode 1700 on any auth failure.
 */
const verifyCasinoRequest = (req, res, next) => {
  const sharedKey = process.env.BC_CASINO_SHARED_KEY;

  // ── Config guard ─────────────────────────────────────────────
  if (!sharedKey) {
    console.error("[Casino Security] BC_CASINO_SHARED_KEY is not configured.");
    return res.status(200).json({
      ResponseCode: 1700,
      Description:  "Server misconfiguration: BC_CASINO_SHARED_KEY missing.",
      Data:         {},
    });
  }

  // ── Raw body guard ───────────────────────────────────────────
  // If rawBody is missing, the express.json verify callback didn't run,
  // which means we can't reconstruct the hash accurately.
  if (!req.rawBody) {
    console.error("[Casino Security] req.rawBody is missing. Ensure express.json verify callback is active in server.js.");
    return res.status(200).json({
      ResponseCode: 1700,
      Description:  "Cannot verify request integrity: raw body unavailable.",
      Data:         {},
    });
  }

  // ── PublicKey extraction ─────────────────────────────────────
  // The Casino API 3.1.4 spec embeds PublicKey in the JSON request body.
  // Some integrations also support sending it as a custom header
  // (e.g., X-Public-Key). We check the body first, fall back to header.
  const receivedPublicKey =
    req.body?.PublicKey ||
    req.headers["x-public-key"] ||
    "";

  // ── Hash comparison ──────────────────────────────────────────
  if (!verifyCasinoHash(req.rawBody, receivedPublicKey, sharedKey)) {
    console.warn(
      `[Casino Security] SHA256 mismatch for ${req.method} ${req.path}. ` +
      `Received PublicKey: ${receivedPublicKey?.slice(0, 16)}...`
    );
    return res.status(200).json({
      ResponseCode: 1700,
      Description:  "Authentication failed. PublicKey SHA256 mismatch.",
      Data:         {},
    });
  }

  next();
};

// ── ROUTES ────────────────────────────────────────────────────────────────────

// GET /api/casino/GetBalance
// BC calls this when loading the game lobby or launching a game.
router.post("/GetBalance",
  verifyCasinoIp, verifyCasinoRequest, getBalance);

// POST /api/casino/Deposit
// BC calls this to credit the player (win payout, bonus).
router.post("/Deposit",
  verifyCasinoIp, verifyCasinoRequest, deposit);

// POST /api/casino/Withdraw
// BC calls this to debit the player (bet stake).
router.post("/Withdraw",
  verifyCasinoIp, verifyCasinoRequest, withdraw);

// POST /api/casino/Rollback
// BC calls this when a game round fails AFTER a Withdraw was processed.
router.post("/Rollback",
  verifyCasinoIp, verifyCasinoRequest, rollback);

module.exports = router;
