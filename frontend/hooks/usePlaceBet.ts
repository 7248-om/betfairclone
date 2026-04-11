import { useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";

export const usePlaceBet = () => {
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Bring in the global action to update UI balance instantly
  const updateBalance = useAuthStore((state) => state.updateBalance);

  const placeBet = async (matchId: string, runnerId: string, stake: number) => {
    try {
      setIsPlacing(true);
      setError(null);

      // We haven't built this backend route yet, but we are wiring it 
      // exactly as requested by the architectural spec.
      const response = await api.post("/client/place-bet", {
        matchId,
        runnerId,
        stake,
      });

      // Based on our typical response structure: { success, data: { bet, newBalance } }
      const { newBalance } = response.data.data;

      // CRITICAL: Immediately sync the global UI balance down by the stake amount
      // without needing to refresh or refetch the /me endpoint.
      if (typeof newBalance === "number") {
        updateBalance(newBalance);
      }

      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to place bet.";
      setError(errorMsg);
      throw new Error(errorMsg); // Throw so the UI can show a toast or local error
    } finally {
      setIsPlacing(false);
    }
  };

  return { placeBet, isPlacing, error };
};
