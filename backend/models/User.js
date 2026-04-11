/**
 * @file models/User.js
 * @description Mongoose schema for the User model.
 *
 * ============================================================
 * 3-TIER USER HIERARCHY
 * ============================================================
 * MAIN  → The platform owner. Can mint virtual coins and create MASTER accounts.
 * MASTER → An agent/sub-admin. Receives coins from MAIN, distributes to CLIENTs.
 * CLIENT → An end-user/bettor. Receives coins from their assigned MASTER and places bets.
 *
 * The `createdBy` field creates the referential link:
 *   - A MASTER's `createdBy` points to the MAIN user who created them.
 *   - A CLIENT's `createdBy` points to the MASTER who onboarded them.
 *   - A MAIN user has no `createdBy` (it's null).
 *
 * ============================================================
 * VIRTUAL COIN ECONOMY — IMPORTANT NOTES
 * ============================================================
 * The `balance` field represents VIRTUAL COINS ONLY.
 * There is NO connection to real-world currency.
 * Coin creation (minting) is a privileged action restricted to MAIN accounts.
 * Coin transfers are tracked via transaction logs (to be built as a separate model).
 */

"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ---- Identity ----
    username: {
      type: String,
      required: [true, "Username is required."],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters."],
      maxlength: [30, "Username cannot exceed 30 characters."],
    },

    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address."],
    },

    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password must be at least 8 characters."],
      select: false, // NEVER return the password in a query by default
    },

    // ---- 3-Tier Account Type ----
    accountType: {
      type: String,
      enum: {
        values: ["MAIN", "MASTER", "CLIENT"],
        message: "accountType must be MAIN, MASTER, or CLIENT.",
      },
      required: [true, "Account type is required."],
      default: "CLIENT",
    },

    // ---- Hierarchy Link ----
    // For MASTER accounts: reference to the MAIN user who created them.
    // For CLIENT accounts: reference to the MASTER user who created them.
    // For MAIN accounts: this field is null.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ---- Virtual Coin Economy ----
    // Represents the user's virtual coin balance.
    // This is a purely internal number — not tied to any real currency.
    // Precision is handled at the application layer; stored as a plain Number.
    balance: {
      type: Number,
      default: 0,
      min: [0, "Balance cannot be negative."],
    },

    // ---- Account Status ----
    isActive: {
      type: Boolean,
      default: true, // Accounts can be suspended by MAIN or their MASTER
    },

    // ---- Quick-Bet Preferences ----
    // Stores the user's custom stake chip values shown on the bet slip.
    // Defaults to [100, 500, 1000, 5000] — the platform standard set.
    stakePreferences: {
      type: [Number],
      default: [100, 500, 1000, 5000],
      validate: {
        validator: (arr) => arr.length > 0 && arr.length <= 8,
        message: "stakePreferences must contain between 1 and 8 values.",
      },
    },
  },
  {
    // Automatically adds `createdAt` and `updatedAt` timestamp fields
    timestamps: true,
  }
);

// ============================================================
// MIDDLEWARE: Hash password before saving
// ============================================================
// This pre-save hook runs automatically before every `save()` call.
// It ensures passwords are NEVER stored in plain text.
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(12); // 12 rounds is strong and not too slow
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ============================================================
// INSTANCE METHOD: Compare entered password with the hashed one
// ============================================================
userSchema.methods.comparePassword = async function (enteredPassword) {
  // `this.password` requires `select: false` to be bypassed
  // by re-selecting it in the query: `.select('+password')`
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
