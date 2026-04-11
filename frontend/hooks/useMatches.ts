import { useState, useEffect } from "react";
import { api } from "../lib/api";

export interface Runner {
  runnerId: string;
  runnerName: string;
  backOdds: number | null;
  layOdds: number | null;
}

export interface Match {
  _id: string;
  betfairEventId: string;
  eventName: string;
  sport: string;
  startTime: string;
  status: string;
  runners: Runner[];
}

export const useMatches = (sport?: string, status?: string) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchMatches = async () => {
      try {
        setIsLoading(true);
        // Build query string
        const params = new URLSearchParams();
        if (sport) params.append("sport", sport);
        if (status) params.append("status", status);
        
        // Use our intercepted axios instance
        const response = await api.get(`/matches?${params.toString()}`);
        
        if (isMounted) {
          // The backend returns { success, pagination, data: matches[] }
          setMatches(response.data.data || []);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.response?.data?.error || "Failed to load matches from server.");
          console.error("Match fetch error:", err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMatches();

    return () => {
      isMounted = false;
    };
  }, [sport, status]);

  return { matches, isLoading, error };
};
