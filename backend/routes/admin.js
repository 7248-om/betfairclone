/**
 * @file routes/admin.js
 * @description Super-admin (MAIN) tier management routes.
 */

"use strict";

const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  mintCoins,
  createMaster,
  listMasters,
  toggleMasterStatus,
} = require("../controllers/adminController");

router.use(protect, restrictTo("MAIN"));

router.post("/mint", mintCoins);
router.post("/masters", createMaster);
router.get("/masters", listMasters);
router.put("/masters/:id/status", toggleMasterStatus);

module.exports = router;
