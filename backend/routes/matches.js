/**
 * @file routes/matches.js
 * @description Read-only match APIs.
 */

"use strict";

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { listMatches, getMatch } = require("../controllers/matchController");

router.use(protect); // Any tier can view matches

router.get("/", listMatches);
router.get("/:id", getMatch);

module.exports = router;
