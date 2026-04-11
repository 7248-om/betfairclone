"use client";

/**
 * @page /app/client/dashboard/page.tsx
 * @description The Sportsbook — Dark Teal theme (R777 style)
 * Dynamically connected to useMatches API and the global useAuthStore.
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import BetSlip from "@/components/BetSlip";
import { useMatches } from "@/hooks/useMatches";
import { useAuthStore } from "@/store/useAuthStore";

interface BetSlipState {
  matchId: string;
  matchTitle: string;
  runnerId: string;
  runnerName: string;
  type: "BACK" | "LAY";
  odds: number;
}

const SPORTS = ["All", "Cricket", "Soccer", "Tennis", "Horse"];

export default function ClientDashboardPage() {
  const { user } = useAuthStore();
  const [sportTab, setSportTab] = useState("All");
  
  // Fetch dynamic matches from our backend API
  // To avoid reloading the entire component space, we pass sport down
  const { matches, isLoading, error } = useMatches(sportTab !== "All" ? sportTab : undefined);
  
  const [betSlip, setBetSlip] = useState<BetSlipState | null>(null);

  const selectOdds = (matchId: string, matchTitle: string, runnerId: string, runnerName: string, type: "BACK" | "LAY", odds: number) => {
    setBetSlip({ matchId, matchTitle, runnerId, runnerName, type, odds });
  };

  return (
    <DashboardLayout 
      accountType="CLIENT" 
      username={user?.username || "Guest"} 
      balance={user?.balance || 0} 
      exposure={0} // TODO: hook up unsettled bets later
    >
      <div className="flex gap-4 h-full">
        {/* ── LEFT: Match area ─────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Sport tab bar */}
          <div
            className="flex gap-0 overflow-x-auto mb-4 rounded overflow-hidden"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            {SPORTS.map((s) => (
              <button
                key={s}
                onClick={() => setSportTab(s)}
                className="px-4 py-2.5 text-xs font-bold whitespace-nowrap flex-shrink-0 uppercase tracking-wide transition-colors"
                style={{
                  backgroundColor: sportTab === s ? "var(--teal)" : "transparent",
                  color: sportTab === s ? "#fff" : "var(--text-secondary)",
                  borderRight: "1px solid var(--border)",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Matches Loading & Error States */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          
          {error && !isLoading && (
            <div className="text-center py-16 text-red-400 bg-red-500/10 rounded">
              {error}
            </div>
          )}

          {/* Match cards */}
          {!isLoading && !error && (
            <div className="space-y-1">
              {matches.map((match) => (
                <div
                  key={match._id}
                  className="rounded overflow-hidden"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
                >
                  {/* Match header */}
                  <div
                    className="flex items-center justify-between px-3 py-2"
                    style={{ backgroundColor: "var(--teal)", borderBottom: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2">
                      {(match.status === "IN_PLAY") && (
                        <span className="text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-sm uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          LIVE
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-900">{match.eventName}</span>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                      {new Date(match.startTime).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {/* Odds table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                          <th className="text-left px-3 py-1.5 font-medium w-1/3" style={{ color: "var(--text-secondary)" }}>
                            Match Odds
                          </th>
                          <th colSpan={1} className="px-2 py-1.5 text-center font-bold" style={{ color: "var(--back-blue)" }}>
                            Back
                          </th>
                          <th colSpan={1} className="px-2 py-1.5 text-center font-bold" style={{ color: "var(--lay-pink)" }}>
                            Lay
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {match.runners.map((runner, ri) => (
                          <tr
                            key={runner.runnerId}
                            style={{
                              borderTop: ri > 0 ? "1px solid var(--border-light)" : undefined,
                            }}
                          >
                            <td className="px-3 py-2.5 font-medium text-slate-900 text-sm">{runner.runnerName}</td>
                            
                            {/* Back Box */}
                            <td className="px-1 py-1 text-center">
                              {runner.backOdds ? (
                                <button
                                  onClick={() => selectOdds(match._id, match.eventName, runner.runnerId, runner.runnerName, "BACK", runner.backOdds!)}
                                  className="w-16 mx-auto text-center py-2 rounded transition-all"
                                  style={{
                                    backgroundColor: betSlip?.runnerId === runner.runnerId && betSlip?.type === "BACK" && betSlip?.odds === runner.backOdds
                                      ? "var(--back-blue)" : "var(--back-blue-bg)",
                                    color: betSlip?.runnerId === runner.runnerId && betSlip?.type === "BACK" && betSlip?.odds === runner.backOdds
                                      ? "#000" : "var(--back-blue)",
                                    border: "1px solid rgba(114,187,239,0.3)",
                                  }}
                                >
                                  <div className="font-bold text-sm leading-tight">{runner.backOdds.toFixed(2)}</div>
                                </button>
                              ) : (
                                <span className="opacity-50">—</span>
                              )}
                            </td>

                            {/* Lay Box */}
                            <td className="px-1 py-1 text-center">
                              {runner.layOdds ? (
                                <button
                                  onClick={() => selectOdds(match._id, match.eventName, runner.runnerId, runner.runnerName, "LAY", runner.layOdds!)}
                                  className="w-16 mx-auto text-center py-2 rounded transition-all"
                                  style={{
                                    backgroundColor: betSlip?.runnerId === runner.runnerId && betSlip?.type === "LAY" && betSlip?.odds === runner.layOdds
                                      ? "var(--lay-pink)" : "var(--lay-pink-bg)",
                                    color: betSlip?.runnerId === runner.runnerId && betSlip?.type === "LAY" && betSlip?.odds === runner.layOdds
                                      ? "#000" : "var(--lay-pink)",
                                    border: "1px solid rgba(250,169,186,0.3)",
                                  }}
                                >
                                  <div className="font-bold text-sm leading-tight">{runner.layOdds.toFixed(2)}</div>
                                </button>
                              ) : (
                                <span className="opacity-50">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {matches.length === 0 && (
                <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
                  No active matches found for {sportTab}.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Bet Slip Container ──────────────────── */}
        <div className="w-80 flex-shrink-0 hidden lg:block relative">
          <div className="sticky top-16">
            {betSlip ? (
              <BetSlip 
                matchId={betSlip.matchId}
                matchName={betSlip.matchTitle}
                runnerId={betSlip.runnerId}
                runnerName={betSlip.runnerName}
                odds={betSlip.odds}
                onClose={() => setBetSlip(null)}
              />
            ) : (
              <div 
                className="rounded overflow-hidden shadow-xl"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="px-4 py-2.5 flex items-center justify-between"
                  style={{ backgroundColor: "var(--teal)" }}
                >
                  <h2 className="text-xs font-bold uppercase tracking-wide">Bet Slip</h2>
                </div>
                <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
                  <p className="text-xs">No active selection.</p>
                  <p className="text-xs mt-1">Select an outcome to place a bet.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
