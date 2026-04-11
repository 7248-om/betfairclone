import { useEffect, useState } from "react";
import { socket } from "../lib/socket";

export function useLiveOdds(
  matchId: string | null,
  runnerId: string | null,
  initialOdds: number | null
) {
  const [liveOdds, setLiveOdds] = useState<number | null>(initialOdds);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  useEffect(() => {
    // Reset state when new match/runner is passed
    setLiveOdds(initialOdds);
    setIsLocked(false);

    if (!matchId || !runnerId) return;

    // Join the WebSocket room for this specific match
    socket.emit("joinMatch", matchId);

    const handleOddsUpdate = (oddsData: any[]) => {
      if (!oddsData || oddsData.length === 0) return;

      const market = oddsData[0]; // Assuming standard API response
      
      // Handle the "SUSPENDED" lock condition
      if (market.status === "SUSPENDED" || market.status === "CLOSED") {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }

      // Update actual odds if available
      if (market.runners) {
        const runner = market.runners.find(
          (r: any) => r.selectionId.toString() === runnerId.toString()
        );

        if (runner?.ex?.availableToBack?.[0]?.price) {
          setLiveOdds(runner.ex.availableToBack[0].price);
        } else if (runner?.status === "REMOVED") {
          setIsLocked(true);
        }
      }
    };

    socket.on("oddsUpdate", handleOddsUpdate);

    return () => {
      // Cleanup listener and leave room to save bandwidth and API limits
      socket.off("oddsUpdate", handleOddsUpdate);
      socket.emit("leaveMatch", matchId);
    };
  }, [matchId, runnerId, initialOdds]);

  return { liveOdds, isLocked };
}
