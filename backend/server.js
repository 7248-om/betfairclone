/**
 * @file server.js
 * @description Main entry point for the backend API server.
 *
 * ============================================================
 * ARCHITECTURE (BetConstruct Provider Model)
 * ============================================================
 * This server is now a "Wallet API" for the BetConstruct (BC) AGP system.
 * BetConstruct handles all betting UI via an embedded iFrame.
 * BC's backend calls OUR /api/bc/* endpoints to:
 *   - Verify user sessions      (GetClientDetails)
 *   - Read user balance         (GetClientBalance)
 *   - Debit balance on bet      (BetPlaced)
 *   - Credit winnings           (BetResulted)
 *   - Reverse failed bets       (Rollback)
 *
 * ALL Betfair polling logic, Socket.io live odds, and the settlement
 * cron job have been REMOVED. Settlement is now driven by BC webhooks.
 *
 * Internal systems retained:
 *   - 3-tier user hierarchy     (MAIN / MASTER / CLIENT)
 *   - Virtual coin economy      (balance, Transaction ledger)
 *   - JWT auth for our own UI   (admin/master/client dashboards)
 */

"use strict";

const express        = require("express");
const http           = require("http");
const cors           = require("cors");
const helmet         = require("helmet");
const mongoSanitize  = require("express-mongo-sanitize");
const rateLimit      = require("express-rate-limit");
const dotenv         = require("dotenv");
const connectDB      = require("./config/db");

// --- Load Environment Variables ---
dotenv.config();

// --- Connect to MongoDB ---
connectDB();

// --- Initialize Express App ---
const app = express();

// ============================================================
// SECTION 1: CORE SECURITY MIDDLEWARE
// ============================================================

// Secure HTTP response headers
app.use(helmet());

// CORS — frontend origin only (BC calls us server-to-server, no CORS needed for /api/bc)
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL
      : ["http://localhost:3000"],
  methods:       ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// Parse incoming JSON request bodies.
// The `verify` callback captures the raw UTF-8 buffer BEFORE Express parses
// it into req.body. This is required by the Casino Integration API 3.1.4 so
// that the SHA256 PublicKey can be recomputed over the exact bytes BC sent.
// Sports Partner API v0.40 endpoints are unaffected — they read req.body normally.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

// Sanitize user-supplied data — prevents MongoDB Operator Injection
app.use(mongoSanitize());

// Rate limiter — applied ONLY to user-facing routes below.
// BetConstruct's server-to-server webhooks (/api/bc, /api/casino) are intentionally
// EXCLUDED: BC may fire rapid bursts during peak traffic (e.g., many concurrent
// game rounds settling), and a 429 response would break the wallet API contract.
const limiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15-minute sliding window
  max:             300,             // max 300 requests per window per IP
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: "Too many requests, please try again later." },
});
// NOTE: Do NOT add app.use(limiter) here — mount it per route below.

// ============================================================
// SECTION 2: API ROUTES
// ============================================================

// ---- Authentication (all tiers) — rate-limited: prevents brute-force login ----
app.use("/api/auth",   limiter, require("./routes/auth"));

// ---- CLIENT tier (account statement, bet history, preferences) ----
app.use("/api/client", limiter, require("./routes/client"));

// ---- MASTER tier (agent management) ----
app.use("/api/master", limiter, require("./routes/master"));

// ---- MAIN / Admin tier (super admin) ----
app.use("/api/admin",  limiter, require("./routes/admin"));

// ---- BetConstruct Sportsbook Partner API (server-to-server webhooks) ----
// NO rate limiter — BC webhook bursts must not be blocked with 429 responses.
// Security is handled by IP whitelist + MD5 hash verification in bcRoutes.js.
app.use("/api/bc",     require("./routes/bcRoutes"));

// ---- BetConstruct Casino Integration API 3.1.4 (server-to-server webhooks) ----
// NO rate limiter — same reasoning as /api/bc above.
// Security: IP whitelist + SHA256 PublicKey verification in bcCasinoRoutes.js.
app.use("/api/casino", require("./routes/bcCasinoRoutes"));

// ============================================================
// SECTION 3: HEALTH CHECK
// ============================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status:      "OK",
    message:     "API server is running (BetConstruct Provider Model).",
    environment: process.env.NODE_ENV,
    timestamp:   new Date().toISOString(),
  });
});

// ============================================================
// SECTION 4: GLOBAL ERROR HANDLERS
// ============================================================

// 404 — unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.stack}`);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "An internal server error occurred.",
  });
});

// ============================================================
// SECTION 5: START SERVER
// ============================================================

const PORT   = process.env.PORT || 5000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(
    `✅ API Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`
  );
  console.log("📡 BetConstruct Sportsbook Partner API  → /api/bc");
  console.log("🎰 BetConstruct Casino Integration API  → /api/casino");
});

module.exports = server;
