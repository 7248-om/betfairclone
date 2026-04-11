/**
 * @file controllers/authController.js
 * @description Authentication endpoints — login and token refresh.
 *
 * Mounted at: POST /api/auth/login
 *             GET  /api/auth/me
 *
 * JWT Signing Pattern:
 *   - Payload contains only { id, accountType } — minimal surface area.
 *   - token is signed using JWT_SECRET with a configurable expiry.
 *   - The raw password hash is NEVER included in any response.
 */

"use strict";

const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ---- Helper: sign a JWT for a given user ----
const signToken = (user) => {
  return jwt.sign(
    { id: user._id, accountType: user.accountType },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// ---- Helper: build a clean user response (never expose password) ----
const buildUserPayload = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  accountType: user.accountType,
  balance: user.balance,
  stakePreferences: user.stakePreferences,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

// ============================================================
// POST /api/auth/login
// ============================================================
/**
 * @desc  Authenticates a user with username + password and returns a JWT.
 * @access Public
 * Body: { username: string, password: string }
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // ---- Input Validation ----
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    // ---- Find user (re-enable password field with +password) ----
    const user = await User.findOne({ username: username.toLowerCase().trim() })
      .select("+password");

    if (!user) {
      // Use a generic message to prevent username enumeration attacks
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // ---- Check account status ----
    if (!user.isActive) {
      return res.status(403).json({
        error: "Your account has been suspended. Please contact your agent.",
      });
    }

    // ---- Verify password ----
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // ---- Issue JWT ----
    const token = signToken(user);

    return res.status(200).json({
      success: true,
      token,
      user: buildUserPayload(user),
    });
  } catch (err) {
    console.error("[login]", err);
    return res.status(500).json({ error: "Authentication failed. Please try again." });
  }
};

// ============================================================
// GET /api/auth/me
// ============================================================
/**
 * @desc  Returns the current logged-in user's profile.
 *        Useful for frontend to restore session state on refresh.
 * @access Private (any role — requires protect middleware)
 * No body needed — identity comes from the JWT via req.user.
 */
const getMe = async (req, res) => {
  try {
    // req.user is attached by the `protect` middleware
    // Re-fetch to get the latest balance/preferences (token may be stale)
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({
      success: true,
      user: buildUserPayload(user),
    });
  } catch (err) {
    console.error("[getMe]", err);
    return res.status(500).json({ error: "Failed to retrieve user profile." });
  }
};

module.exports = { login, getMe };
