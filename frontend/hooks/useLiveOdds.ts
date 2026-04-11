import { useEffect, useState } from "react";
import { socket } from "../lib/socket";

export interface RunnerOdds {
  back: number | null;
  lay: number | null;
}

export interface LiveOddsState {
  [runnerId: string]: RunnerOdds;
}

export function useLiveOdds(matchId: string | null) {
  const [liveOdds, setLiveOdds] = useState<LiveOddsState>({});
  const [isLocked, setIsLocked] = useState<boolean>(false);

  useEffect(() => {
    // Reset defaults
    setLiveOdds({});
    setIsLocked(false);

    if (!matchId) return;

    // Explicitly connect to save backend proxy bandwidth
    if (!socket.connected) {
      socket.connect();
    }

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

      // Extract the Back/Lay prices into an object mapping
      if (market.runners) {
        const newOddsState: LiveOddsState = {};
        market.runners.forEach((runner: any) => {
          const back = runner?.ex?.availableToBack?.[0]?.price || null;
          const lay = runner?.ex?.availableToLay?.[0]?.price || null;
          newOddsState[runner.selectionId.toString()] = { back, lay };
          
          if (runner?.status === "REMOVED") {
            setIsLocked(true);
          }
        });
        setLiveOdds(newOddsState);
      }
    };

    socket.on("oddsUpdate", handleOddsUpdate);

    return () => {
      // Cleanup listener and properly disconnect everything when going stale
      socket.off("oddsUpdate", handleOddsUpdate);
      socket.emit("leaveMatch", matchId);
      socket.disconnect(); 
    };
  }, [matchId]);

  return { liveOdds, isLocked };
}
