/**
 * @file models/User.js
 * @description Mongoose schema for the User model.
 *
 * ============================================================
 * 3-TIER USER HIERARCHY
 * ============================================================
 * MAIN   → The platform owner. Can mint virtual coins and create MASTER accounts.
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
 * Coin transfers are tracked via transaction logs (Transaction model).
 *
 * ============================================================
 * BETCONSTRUCT INTEGRATION FIELDS
 * ============================================================
 * currencyId  → ISO 4217 currency code returned in GetClientDetails (default: 'USD').
 *               Also embedded in the BC iFrame URL so BC knows which wallet to display.
 * languageId  → IETF language tag returned in GetClientDetails (default: 'en').
 *               Used to localise the BC iFrame UI.
 * externalId  → A secondary identifier. Maps this user to an ID in an external system.
 *               If not set, the application layer falls back to _id.toString().
 *               Useful when BC or a third-party system uses a different numeric scheme.
 */

"use strict";

const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ---- Identity ----
    username: {
      type:      String,
      required:  [true, "Username is required."],
      unique:    true,
      trim:      true,
      lowercase: true,
      minlength: [3,  "Username must be at least 3 characters."],
      maxlength: [30, "Username cannot exceed 30 characters."],
    },

    email: {
      type:      String,
      required:  [true, "Email is required."],
      unique:    true,
      trim:      true,
      lowercase: true,
      match:     [/^\S+@\S+\.\S+$/, "Please use a valid email address."],
    },

    password: {
      type:      String,
      required:  [true, "Password is required."],
      minlength: [8, "Password must be at least 8 characters."],
      select:    false, // NEVER return the password in a query by default
    },

    // ---- 3-Tier Account Type ----
    accountType: {
      type: String,
      enum: {
        values:  ["MAIN", "MASTER", "CLIENT"],
        message: "accountType must be MAIN, MASTER, or CLIENT.",
      },
      required: [true, "Account type is required."],
      default:  "CLIENT",
    },

    // ---- Hierarchy Link ----
    // For MASTER accounts: reference to the MAIN user who created them.
    // For CLIENT accounts: reference to the MASTER user who created them.
    // For MAIN accounts: this field is null.
    createdBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    // ---- Virtual Coin Economy ----
    // Represents the user's virtual coin balance.
    // This is a purely internal number — not tied to any real currency.
    balance: {
      type:    Number,
      default: 0,
      min:     [0, "Balance cannot be negative."],
    },

    // ---- Account Status ----
    isActive: {
      type:    Boolean,
      default: true, // Accounts can be suspended by MAIN or their MASTER
    },

    // ---- Quick-Bet Preferences ----
    // Stores the user's custom stake chip values shown on the bet slip.
    // Defaults to [100, 500, 1000, 5000] — the platform standard set.
    stakePreferences: {
      type:    [Number],
      default: [100, 500, 1000, 5000],
      validate: {
        validator: (arr) => arr.length > 0 && arr.length <= 8,
        message:   "stakePreferences must contain between 1 and 8 values.",
      },
    },

    // ---- BetConstruct Integration Fields ----

    // ISO 4217 currency code (e.g. 'USD', 'EUR', 'GBP').
    // Returned in GetClientDetails and used to configure the BC iFrame wallet.
    currencyId: {
      type:      String,
      trim:      true,
      uppercase: true,
      default:   "USD",
      maxlength: [10, "currencyId must be a valid ISO 4217 currency code."],
    },

    // IETF language tag (e.g. 'en', 'de', 'fr').
    // Returned in GetClientDetails and used to localise the BC iFrame.
    languageId: {
      type:      String,
      trim:      true,
      lowercase: true,
      default:   "en",
      maxlength: [10, "languageId must be a valid IETF language tag."],
    },

    // Optional secondary identifier for external system mapping.
    // Falls back to _id.toString() at the application layer if null.
    externalId: {
      type:    String,
      trim:    true,
      default: null,
      index:   true,
      sparse:  true, // Allows multiple null values in the sparse index
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
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt     = await bcrypt.genSalt(12);
  this.password  = await bcrypt.hash(this.password, salt);
  next();
});

// ============================================================
// INSTANCE METHOD: Compare entered password with the hashed one
// ============================================================
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
