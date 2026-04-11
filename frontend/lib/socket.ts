import { io, Socket } from "socket.io-client";

// Connect to the backend API URL
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Export a singleton socket instance
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: true,
  // Make sure to include credentials if cookie-based sessions are used
  withCredentials: true,
});
