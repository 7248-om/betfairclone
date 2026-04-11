"use strict";

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./models/User");

// Load backend env variables directly
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function seedUsers() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB for seeding...");

    // Remove users to reset their passwords safely
    // Or we can just find and save them to trigger the pre('save') hook
    const usersToUpdate = ["admin", "master_asia", "client1"];
    
    for (const username of usersToUpdate) {
      let user = await User.findOne({ username });
      if (user) {
        user.password = "password123";
        await user.save();
        console.log(`Updated password for ${username} to 'password123'`);
      } else {
        // Create if missing
        if (username === "admin") {
          await User.create({ username: "admin", email: "admin@stakeclone.com", password: "password123", accountType: "MAIN", balance: 0 });
        } else if (username === "master_asia") {
          await User.create({ username: "master_asia", email: "asia@stakeclone.com", password: "password123", accountType: "MASTER", balance: 100000 });
        } else if (username === "client1") {
          await User.create({ username: "client1", email: "client1@stakeclone.com", password: "password123", accountType: "CLIENT", balance: 5000 });
        }
        console.log(`Created ${username} with password 'password123'`);
      }
    }

    console.log("Seeding complete. Exiting.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
}

seedUsers();
