/**
 * @file middleware/authMiddleware.js
 * @description JWT Authentication & Role-Based Access Control Middleware
 */

"use strict";

const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ============================================================
// protect — Verify JWT and attach user to req.user
// ============================================================
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorised. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ error: "The user belonging to this token no longer exists." });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Your account has been suspended. Contact your agent." });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token. Please log in again." });
    }
    next(err);
  }
};

// ============================================================
// restrictTo — Gate a route to specific account types
// ============================================================
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.accountType)) {
      return res.status(403).json({
        error: `Access denied. This route is restricted to: ${roles.join(", ")}.`,
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
