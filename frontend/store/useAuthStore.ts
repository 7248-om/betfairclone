import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  email: string;
  accountType: 'MAIN' | 'MASTER' | 'CLIENT';
  balance: number;
  stakePreferences: number[];
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  /** True once persist middleware has finished rehydrating from localStorage.
   *  Guards use auth redirect so we never redirect before we know the real state. */
  _hasHydrated: boolean;

  // Actions
  login: (user: User, token: string) => void;
  logout: () => void;
  updateBalance: (newBalance: number) => void;
  /** Reactively update stakePreferences — never mutate store state directly. */
  updateStakePreferences: (prefs: number[]) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,

      login: (user, token) => set({ user, token, isAuthenticated: true }),

      logout: () => set({ user: null, token: null, isAuthenticated: false }),

      updateBalance: (newBalance) =>
        set((state) => ({
          user: state.user ? { ...state.user, balance: newBalance } : null,
        })),

      updateStakePreferences: (prefs) =>
        set((state) => ({
          user: state.user ? { ...state.user, stakePreferences: prefs } : null,
        })),

      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        // Called once localStorage hydration is complete.
        // Pages must wait for this before trusting isAuthenticated.
        state?.setHasHydrated(true);
      },
    }
  )
);
