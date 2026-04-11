/**
 * @file routes/auth.js
 * @description Authentication routes.
 */

"use strict";

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { login, getMe } = require("../controllers/authController");

// Public
router.post("/login", login);

// Private
router.get("/me", protect, getMe);

module.exports = router;
