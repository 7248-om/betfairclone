import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Define the shape of our User object returned by the backend
export interface User {
  id: string;
  username: string;
  email: string;
  accountType: 'MAIN' | 'MASTER' | 'CLIENT';
  balance: number;
  stakePreferences: number[];
  isActive: boolean;
}

// Define the shape of our global Auth State and Actions
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (user: User, token: string) => void;
  logout: () => void;
  updateBalance: (newBalance: number) => void;
}

// Create the Zustand store with persist middleware
// This ensures the user stays logged in across page refreshes
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // Login Action: Commits user & token to state
      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),

      // Logout Action: Clears all auth state
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),

      // Balance Update Action: Specifically for fast UI updates after placing bets
      updateBalance: (newBalance) =>
        set((state) => ({
          user: state.user ? { ...state.user, balance: newBalance } : null,
        })),
    }),
    {
      name: 'auth-storage', // The key used in localStorage
      // Persist everything (user & token) so they survive refreshes
    }
  )
);
