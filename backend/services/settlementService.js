/**
 * @file services/settlementService.js
 * @description Background engine that polls Betfair for match results and auto-settles bets.
 *
 * ============================================================
 * SETTLEMENT LIFECYCLE
 * ============================================================
 * 1. Find all local matches marked as OPEN or IN_PLAY where the
 *    sportsbook event has logically concluded (e.g., past expected end).
 * 2. Hit the Betfair API (via the proxy) to see if the market is actually SETTLED.
 * 3. Wait for the `winnerRunnerId` to be declared by Betfair.
 * 4. Update the local Match cache to SETTLED.
 * 5. Pull all OPEN bets tied to that match.
 * 6. Wrap the validation, status update, and VC payout logic inside a MongoDB
 *    Transaction to guarantee financial atomicity.
 *
 * This service runs completely autonomously via `cron/settlementJob.js`.
 */

"use strict";

const mongoose = require("mongoose");
const Match = require("../models/Match");
const Bet = require("../models/Bet");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { fetchMarketSettlement } = require("./betfairProxy");

/**
 * Executes a single match settlement run.
 * Handles the payouts for all OPEN bets on a specific match.
 *
 * @param {Object} match - The populated match document
 * @param {string} declaredWinnerRunnerId - Supplied by Betfair
 * @param {boolean} isVoid - Supplied by Betfair (if the whole market is cancelled)
 */
const settleMatchBets = async (match, declaredWinnerRunnerId, isVoid = false) => {
  // Use a dedicated session for this specific match's payouts
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1. Mark the match as SETTLED/VOIDed in the DB
    match.status = isVoid ? "VOID" : "SETTLED";
    if (!isVoid && declaredWinnerRunnerId) {
      match.winnerRunnerId = declaredWinnerRunnerId;
    }
    await match.save({ session });

    // 2. Fetch all OPEN bets for this specific match
    const openBets = await Bet.find({ match: match._id, status: "OPEN" }).session(session);

    if (openBets.length === 0) {
      // Nothing to settle on this match
      await session.commitTransaction();
      session.endSession();
      console.log(`[SETTLEMENT] Match ${match.betfairEventId} settled. No active bets found.`);
      return;
    }

    console.log(`[SETTLEMENT] Processing ${openBets.length} bets for Match ${match.betfairEventId}...`);

    for (const bet of openBets) {
      let betStatus = "LOST";
      let payoutAmount = 0;
      let transactionType = null;
      let description = "";

      if (isVoid) {
        // Market was cancelled by Betfair → refund original stake
        betStatus = "VOID";
        payoutAmount = bet.stake;
        transactionType = "BET_REFUND";
        description = `Refund: ${match.eventName} (Market Voided)`;
      } else if (bet.selectedRunnerId === declaredWinnerRunnerId) {
        // Winner → pay out the full potential return (stake + win)
        betStatus = "WON";
        payoutAmount = bet.potentialPayout;
        transactionType = "BET_WON";
        description = `Winnings: ${match.eventName} (${bet.selectedRunnerName})`;
      } else {
        // Loser → no payout. (Stake was already deducted at placement)
        betStatus = "LOST";
        description = `Lost: ${match.eventName} (${bet.selectedRunnerName})`;
      }

      // Update the bet document
      bet.status = betStatus;
      bet.settledAt = new Date();
      await bet.save({ session });

      // If the bet WON or VOIDED, we must credit the user's balance
      if (payoutAmount > 0) {
        // Atomically increment the user's balance
        const updatedUser = await User.findByIdAndUpdate(
          bet.user,
          { $inc: { balance: payoutAmount } },
          { new: true, session }
        );

        if (!updatedUser) {
          throw new Error(`User ${bet.user} not found while processing bet ${bet._id}`);
        }

        // Record the transaction ledger entry
        await Transaction.create(
          [
            {
              user: bet.user,
              type: transactionType,
              amount: payoutAmount,
              runningBalance: updatedUser.balance,
              description: description,
              referenceId: bet._id,
              referenceModel: "Bet",
            },
          ],
          { session }
        );
      }
    }

    // Commit the entire batch of payouts for this match atomically
    await session.commitTransaction();
    session.endSession();

    console.log(`[SETTLEMENT] ✅ Match ${match.betfairEventId} settled successfully.`);
  } catch (err) {
    // If ANY step fails (e.g. user missing, DB timeout), roll back EVERYTHING for this match
    // to prevent partial payouts.
    await session.abortTransaction();
    session.endSession();
    console.error(`[SETTLEMENT] ❌ FATAL ERROR settling match ${match.betfairEventId}:`, err);
  }
};

/**
 * Main orchestrator: Finds eligible matches and coordinates the Betfair checks.
 */
const runSettlementCycle = async () => {
  console.log(`[SETTLEMENT] Cycle starting at ${new Date().toISOString()}`);

  try {
    // 1. Find matches that are open/in-play where the start time was over 2 hours ago.
    // (Actual production logic would be more sophisticated based on sport duration,
    // but this serves as the foundational trigger).
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const pendingMatches = await Match.find({
      status: { $in: ["OPEN", "IN_PLAY"] },
      startTime: { $lt: twoHoursAgo },
    });

    if (pendingMatches.length === 0) {
      console.log(`[SETTLEMENT] No matches pending settlement.`);
      return;
    }

    console.log(`[SETTLEMENT] Interrogating Betfair for ${pendingMatches.length} pending matches...`);

    // 2. Iterate and ask Betfair for the final status of each match
    for (const match of pendingMatches) {
      try {
        // Ask the Betfair proxy if the market has concluded
        const bfResult = await fetchMarketSettlement(match.betfairMarketId);

        if (!bfResult.isSettled) {
          // Event is still ongoing in real life. Skip it and try again next cron cycle.
          continue;
        }

        // Event has concluded. Run the atomic payout engine.
        await settleMatchBets(match, bfResult.winnerRunnerId, bfResult.isVoid);
      } catch (bfErr) {
        // Catch gracefully so one failed Betfair call doesn't break the loop for other matches
        console.error(`[SETTLEMENT] Betfair check failed for market ${match.betfairMarketId}:`, bfErr.message);
      }
    }
  } catch (err) {
    console.error(`[SETTLEMENT] Core cycle failure:`, err);
  }
};

module.exports = {
  runSettlementCycle,
};
