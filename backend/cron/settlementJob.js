/**
 * @file cron/settlementJob.js
 * @description Scheduled background job that triggers the settlement engine.
 */

"use strict";

const cron = require("node-cron");
const { runSettlementCycle } = require("../services/settlementService");

/**
 * Initializes and starts the background settlement job.
 * Should be called once during server startup.
 */
const startSettlementCron = () => {
  // Pattern: Runs every 5 minutes
  // Minute, Hour, Day of Month, Month, Day of Week
  const cronSchedule = "*/5 * * * *";

  console.log(`[CRON] Registering settlement job on schedule: ${cronSchedule}`);

  const task = cron.schedule(
    cronSchedule,
    async () => {
      // Execute the settlement service
      await runSettlementCycle();
    },
    {
      scheduled: true,
      timezone: "UTC", // Standardize on UTC to match Betfair's event times
    }
  );

  return task;
};

module.exports = { startSettlementCron };
