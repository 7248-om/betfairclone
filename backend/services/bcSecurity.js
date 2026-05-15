/**
 * @file services/bcSecurity.js
 * @description BetConstruct Partner API v0.40 — Security Utilities
 *
 * ============================================================
 * HASH CONSTRUCTION RULES (Partner API v0.40 spec)
 * ============================================================
 * 1. Take the VALUES of the specified parameters (NOT the keys).
 * 2. Maintain the EXACT order defined per endpoint below.
 * 3. Skip parameters whose value is empty / null / undefined.
 * 4. Concatenate the remaining values into a single string.
 * 5. Append the SharedKey at the very end.
 * 6. MD5-hash the resulting string.
 * 7. The output MUST be ALL LOWERCASE hex.
 *
 * ============================================================
 * TIMESTAMP RULES
 * ============================================================
 * BC sends `TS` as Unix epoch SECONDS in every request body.
 * Reject any request where |now_seconds - TS| > 120.
 * This prevents replay attacks.
 *
 * ============================================================
 * HASH PARAMETER ORDER PER ENDPOINT (Partner API v0.40)
 * ============================================================
 * GetClientDetails : AuthToken, TS
 * GetClientBalance : AuthToken, TS
 * BetPlaced        : AuthToken, TS, TransactionId, BetId, Amount,
 *                    Created, BetType, SystemMinCount, TotalPrice
 * BetResulted      : AuthToken, TS, TransactionId, BetId, BetState,
 *                    Amount, BonusAmount, BonusId
 * Rollback         : AuthToken, TS, TransactionId
 */

"use strict";

// Built-in Node.js crypto — used by Casino Integration API 3.1.4 (SHA256).
// No extra npm install required.
const crypto = require("crypto");

// MD5 — used by Sports Partner API v0.40.
const md5 = require("md5");

// ============================================================
// PER-ENDPOINT PARAMETER ORDER MAP
// ============================================================
// Each key matches the Express route name / POST body endpoint field.
// Values are arrays of request body keys in the exact hash order.
// 'Hash' itself is NEVER included in hash computation.
const HASH_PARAM_ORDERS = Object.freeze({
  GetClientDetails: ["AuthToken", "TS"],
  GetClientBalance: ["AuthToken", "TS"],
  BetPlaced:        ["AuthToken", "TS", "TransactionId", "BetId", "Amount", "Created", "BetType", "SystemMinCount", "TotalPrice"],
  BetResulted:      ["AuthToken", "TS", "TransactionId", "BetId", "BetState", "Amount", "BonusAmount", "BonusId"],
  Rollback:         ["AuthToken", "TS", "TransactionId"],
});

// ============================================================
// computeHash
// ============================================================
/**
 * Builds the MD5 signature that BetConstruct expects.
 *
 * @param {Object}   params     - The full parsed request body.
 * @param {string[]} paramOrder - Ordered array of body keys for this endpoint.
 * @param {string}   sharedKey  - The SharedKey from BC back-office (from env).
 * @returns {string}            - Lowercase MD5 hex digest.
 *
 * @example
 *   computeHash(req.body, HASH_PARAM_ORDERS.BetPlaced, process.env.BC_SHARED_KEY)
 *   // → "a3f2e1..."
 */
const computeHash = (params, paramOrder, sharedKey) => {
  const concatenated =
    paramOrder
      .filter((key) => {
        const v = params[key];
        return v !== undefined && v !== null && v !== "";
      })
      .map((key) => String(params[key]))
      .join("") + sharedKey;

  return md5(concatenated).toLowerCase();
};

// ============================================================
// verifyHash
// ============================================================
/**
 * Computes the expected hash and compares it against the one in the request.
 *
 * @param {Object}   params     - Full request body (includes 'Hash' field from BC).
 * @param {string[]} paramOrder - Per-endpoint key order (exclude 'Hash').
 * @param {string}   sharedKey  - SharedKey from env.
 * @returns {boolean}           - true if hashes match.
 */
const verifyHash = (params, paramOrder, sharedKey) => {
  const expected = computeHash(params, paramOrder, sharedKey);
  const received = (params.Hash || "").toLowerCase();
  return expected === received;
};

// ============================================================
// verifyTimestamp
// ============================================================
/**
 * Validates the TS (Unix seconds) field sent by BetConstruct.
 * Rejects requests older than 120 seconds to block replay attacks.
 *
 * @param {number|string} ts - The TS value from req.body.
 * @returns {{ valid: boolean, message?: string }}
 */
const verifyTimestamp = (ts) => {
  if (ts === undefined || ts === null || ts === "") {
    return { valid: false, message: "TS field is missing." };
  }

  const receivedTs = parseInt(ts, 10);
  if (isNaN(receivedTs)) {
    return { valid: false, message: "TS is not a valid integer." };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const delta      = Math.abs(nowSeconds - receivedTs);

  if (delta > 120) {
    return {
      valid:   false,
      message: `Request is ${delta}s old. Maximum allowed is 120s.`,
    };
  }

  return { valid: true };
};

// ============================================================
// computeCasinoHash  — Casino Integration API 3.1.4
// ============================================================
/**
 * Builds the SHA256 PublicKey used by the BetConstruct Casino API.
 *
 * Formula (from Casino Integration API 3.1.4 spec):
 *   PublicKey = SHA256(MessageJsonBody + CasinoSharedKey)
 *
 * Where:
 *   - MessageJsonBody is the EXACT raw JSON string BC sent in the request
 *     body (captured via the express.json verify callback as req.rawBody).
 *   - CasinoSharedKey is the secret assigned in the BC Casino back-office
 *     (stored in process.env.BC_CASINO_SHARED_KEY).
 *
 * @param {string} rawJsonBodyString - req.rawBody set by express.json verify.
 * @param {string} casinoSharedKey  - BC_CASINO_SHARED_KEY from env.
 * @returns {string}                 - Lowercase hex SHA256 digest.
 */
const computeCasinoHash = (rawJsonBodyString, casinoSharedKey) => {
  const input = rawJsonBodyString + casinoSharedKey;
  return crypto.createHash("sha256").update(input, "utf8").digest("hex").toLowerCase();
};

// ============================================================
// verifyCasinoHash  — Casino Integration API 3.1.4
// ============================================================
/**
 * Computes the expected Casino SHA256 hash and compares it to the one
 * received from BetConstruct (usually in the request body as `PublicKey`
 * or a custom header — check your BC Casino back-office for exact placement).
 *
 * @param {string} rawJsonBodyString  - req.rawBody from express.json verify.
 * @param {string} receivedPublicKey  - Hash value sent by BC in the request.
 * @param {string} casinoSharedKey   - BC_CASINO_SHARED_KEY from env.
 * @returns {boolean}                 - true if hashes match.
 */
const verifyCasinoHash = (rawJsonBodyString, receivedPublicKey, casinoSharedKey) => {
  const expected = computeCasinoHash(rawJsonBodyString, casinoSharedKey);
  const received = (receivedPublicKey || "").toLowerCase();
  return expected === received;
};

module.exports = {
  // ── Sports Partner API v0.40 (MD5) ──
  computeHash,
  verifyHash,
  verifyTimestamp,
  HASH_PARAM_ORDERS,
  // ── Casino Integration API 3.1.4 (SHA256) ──
  computeCasinoHash,
  verifyCasinoHash,
};
