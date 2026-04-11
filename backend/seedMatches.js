"use strict";

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Match = require("./models/Match");

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function seedMatches() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB for matching seeds...");

    await Match.deleteMany({}); // Reset matches

    // Seed data
    const matches = [
      {
        betfairEventId: "100000001",
        betfairMarketId: "1.23456789",
        sport: "Cricket",
        eventName: "Scotland V Oman - ICC Cricket World Cup League 2",
        status: "IN_PLAY",
        startTime: new Date(),
        runners: [
          { runnerId: "1001", runnerName: "Scotland", backOdds: 1.55, layOdds: 1.6 },
          { runnerId: "1002", runnerName: "Oman", backOdds: 2.46, layOdds: 2.5 },
        ],
        settlementStatus: "UNSETTLED",
      },
      {
        betfairEventId: "100000002",
        betfairMarketId: "1.99887766",
        sport: "Soccer",
        eventName: "Manchester City V Arsenal - Premier League",
        status: "OPEN",
        startTime: new Date(Date.now() + 86400000), // Tomorrow
        runners: [
          { runnerId: "2001", runnerName: "Manchester City", backOdds: 2.10, layOdds: 2.12 },
          { runnerId: "2002", runnerName: "Arsenal", backOdds: 3.50, layOdds: 3.60 },
          { runnerId: "2003", runnerName: "The Draw", backOdds: 3.10, layOdds: 3.15 },
        ],
        settlementStatus: "UNSETTLED",
      },
      {
        betfairEventId: "100000003",
        betfairMarketId: "1.55443322",
        sport: "Tennis",
        eventName: "C Alcaraz V N Djokovic - Wimbledon Semi Final",
        status: "OPEN",
        startTime: new Date(Date.now() + 172800000),
        runners: [
          { runnerId: "3001", runnerName: "Carlos Alcaraz", backOdds: 1.85, layOdds: 1.87 },
          { runnerId: "3002", runnerName: "Novak Djokovic", backOdds: 2.05, layOdds: 2.08 },
        ],
        settlementStatus: "UNSETTLED",
      }
    ];

    await Match.insertMany(matches);
    console.log("Successfully seeded 3 matches into the database.");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding matches:", err);
    process.exit(1);
  }
}

seedMatches();
