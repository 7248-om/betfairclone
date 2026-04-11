import axios from "axios";

// Read API URL from env, fallback to localhost:5000 if not set
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/**
 * Global Axios Instance for Stake Clone API
 * 
 * Automatically attaches the JWT token from local storage to every 
 * outgoing request using an interceptor.
 */
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // Set a reasonable timeout so the UI doesn't hang forever
  timeout: 10000,
});

// ── Request Interceptor ────────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // We store the token in localStorage based on the auth store design
    // The Zustand store syncs to localStorage, so we read it directly here
    // to ensure we always have the freshest token before network dispatches.
    if (typeof window !== "undefined") {
      try {
        const authStorage = localStorage.getItem("auth-storage");
        if (authStorage) {
          const { state } = JSON.parse(authStorage);
          if (state.token) {
            config.headers.Authorization = `Bearer ${state.token}`;
          }
        }
      } catch (e) {
        console.error("Failed to parse auth token", e);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ── Response Interceptor ───────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the token is expired or invalid, the backend returns 401.
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        // Here we could trigger a global unauthenticated event.
        // For now, the caller handles the error and invokes logout().
      }
    }
    return Promise.reject(error);
  }
);

export default api;
