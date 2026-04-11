"use strict";

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Listen for client joining a specific match room
    socket.on("joinMatch", (matchId) => {
      if (!matchId) return;
      socket.join(matchId);
      console.log(`[Socket.io] Socket ${socket.id} joined room: ${matchId}`);
    });

    // Listen for client leaving a specific match room
    socket.on("leaveMatch", (matchId) => {
      if (!matchId) return;
      socket.leave(matchId);
      console.log(`[Socket.io] Socket ${socket.id} left room: ${matchId}`);
    });

    // Handle disconnects
    socket.on("disconnect", () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
};
