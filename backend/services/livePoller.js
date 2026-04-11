"use strict";

const betfairProxy = require("./betfairProxy");

// Lock flag to prevent overlapping polling cycles and API rate-limit bans
let isPolling = false;

const startLivePoller = (io) => {
  console.log("[LivePoller] Starting 1.5s live odds poller...");

  setInterval(async () => {
    // CRITICAL: If the previous cycle is still running, skip this one
    // to prevent memory leaks and API rate-limit bans.
    if (isPolling) {
      return;
    }

    try {
      isPolling = true;

      // Identify all active Socket.io rooms (matchIds) that have at least 1 connected client.
      const activeMatchIds = [];
      const rooms = io.sockets.adapter.rooms;
      
      for (const [room, clients] of rooms.entries()) {
        // Exclude the default rooms created for individual socket connections
        // (If the room name matches a socket id, it's not a matchId room)
        if (!io.sockets.sockets.has(room)) {
            // Check if room has at least 1 client connected
            if (clients.size > 0) {
                activeMatchIds.push(room);
            }
        }
      }

      // If no users are viewing any live match, just exit the cycle early
      if (activeMatchIds.length === 0) {
          return;
      }

      // Fetch odds and broadcast exactly to active rooms
      for (const matchId of activeMatchIds) {
        try {
          const oddsData = await betfairProxy.fetchMarketOdds(matchId);
          if (oddsData) {
            // Immediate broadcast
            io.to(matchId).emit("oddsUpdate", oddsData);
          }
        } catch (err) {
          console.error(`[LivePoller] Failed to fetch odds for match ${matchId}:`, err.message);
        }
      }

    } catch (err) {
      console.error("[LivePoller] Critical error in poller loop:", err);
    } finally {
      // Release lock
      isPolling = false;
    }
  }, 1500); // 1.5 seconds interval
};

module.exports = {
  startLivePoller,
};
