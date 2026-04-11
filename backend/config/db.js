/**
 * @file config/db.js
 * @description Mongoose connection utility for MongoDB.
 *
 * This module establishes and manages the single MongoDB connection for the app.
 * It is called once at startup from server.js.
 *
 * Connection events are logged for observability.
 * The URI is loaded from the MONGO_URI environment variable — never hardcoded.
 */

"use strict";

const mongoose = require("mongoose");

/**
 * Connects to the MongoDB database using the URI from environment variables.
 * Exits the process on failure to prevent the server from running without a DB.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options suppress deprecation warnings in Mongoose 6+
      // and are good practice for a robust connection.
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Exit process with failure — the app cannot function without a database.
    process.exit(1);
  }
};

// Handle unexpected disconnections after initial connection
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconnected.");
});

module.exports = connectDB;
