/**
 * @file server.js
 * @description Main entry point for the Stake Clone backend API server.
 *
 * Architecture Overview:
 * - This server manages TWO completely separate data streams:
 *   1. INTERNAL: The Virtual Coin economy (users, bets, balances) stored in MongoDB.
 *   2. EXTERNAL: Live sports data fetched from Betfair API via a UK proxy (services/betfairProxy.js).
 *
 * The Betfair data is READ-ONLY from this server's perspective. It is fetched,
 * cached in MongoDB (Match model), and then presented to the frontend.
 * No real money or real accounts are created anywhere in this system.
 */

"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize"); // NEW: Prevent NoSQL injection
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { startSettlementCron } = require("./cron/settlementJob"); // NEW: Background payouts

// --- Load Environment Variables ---
dotenv.config();

// --- Connect to MongoDB ---
connectDB();

// --- Initialize Express App ---
const app = express();

// ============================================================
// SECTION 1: CORE SECURITY MIDDLEWARE
// ============================================================

// Helmet sets secure HTTP response headers (prevents XSS, clickjacking, etc.)
app.use(helmet());

// CORS: Restrict which origins can call this API.
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL
      : ["http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// Parse incoming JSON request bodies
app.use(express.json());

// Sanitize user-supplied data to prevent MongoDB Operator Injection
app.use(mongoSanitize());

// Global Rate Limiter: Prevents brute-force and DoS attacks.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// ============================================================
// SECTION 2: API ROUTES
// ============================================================
// Routes are organized by the 3-tier user hierarchy.

// ---- Authentication (all tiers) ----
app.use('/api/auth', require('./routes/auth'));

// ---- CLIENT tier ----
app.use("/api/client", require("./routes/client"));

// ---- MASTER tier (+ MAIN oversight of masters) ----
app.use("/api/master", require("./routes/master"));

// ---- MAIN tier (super admin) ----
app.use('/api/admin', require('./routes/admin'));

// ---- Match data (Betfair cache) ----
app.use('/api/matches', require('./routes/matches'));

// ============================================================
// SECTION 3: BACKGROUND JOBS
// ============================================================

// Start the autonomous settlement engine (checks for concluded matches and pays out bets)
if (process.env.NODE_ENV !== "test") {
  startSettlementCron();
}

// ============================================================
// SECTION 4: HEALTH CHECK
// ============================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Stake Clone API is running.",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// SECTION 5: GLOBAL ERROR HANDLER
// ============================================================

// Catch-all for unmatched routes (404)
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// Central error-handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.stack}`);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "An internal server error occurred.",
  });
});

// ============================================================
// SECTION 6: START SERVER
// ============================================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(
    `✅ Stake Clone API Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`
  );
});

module.exports = app;
