/**
 * @file middleware/hierarchyMiddleware.js
 * @description Validates that a user has access to a specific downline client.
 */

"use strict";

const mongoose = require("mongoose");
const User = require("../models/User");

// ============================================================
// verifyDownlineAccess
// ============================================================
// Ensure that the requested clientId belongs to the logged-in MASTER.
// MAIN users bypass this check.
const verifyDownlineAccess = async (req, res, next) => {
  try {
    const { clientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ error: "Invalid client ID format." });
    }

    const client = await User.findById(clientId).select("username accountType createdBy isActive balance");

    if (!client) {
      return res.status(404).json({ error: "Client not found." });
    }

    if (client.accountType !== "CLIENT") {
      return res.status(400).json({ error: "Target account is not a CLIENT." });
    }

    // MAIN accounts can access any client. MASTER accounts can only access downlines.
    if (
      req.user.accountType === "MASTER" &&
      client.createdBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        error: "Access denied. This client does not belong to your account.",
      });
    }

    // Attach the validated client to the request object so subsequent 
    // controllers don't need to fetch it again.
    req.client = client;
    next();
  } catch (err) {
    console.error("[verifyDownlineAccess]", err);
    return res.status(500).json({ error: "Failed to verify downline access." });
  }
};

module.exports = { verifyDownlineAccess };
