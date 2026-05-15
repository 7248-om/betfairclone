"use client";

/**
 * @page /app/client/bets/page.tsx
 * @description My Bets — Paginated list of BetConstruct-managed bets.
 *
 * ============================================================
 * SCHEMA CHANGE (Betfair → BetConstruct)
 * ============================================================
 * Old fields removed: match, selectedRunnerName, oddsAtPlacement, stake, potentialPayout
 * New BC fields: bcBetId, bcTransactionId, bcAmount, bcTotalPrice, bcSelections, status
 *
 * Status values: OPEN | WON | LOST | RETURNED | CASHED_OUT | VOID
 * ============================================================
 */

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuthStore } from "@/store/useAuthStore";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single bet selection as stored in bcSelections[] on the Bet document. */
interface BcSelection {
  EventName?: string;
  MarketName?: string;
  RunnerName?: string;
  Odds?: number;
}

/** Shape of a Bet document returned by /api/client/bets/history */
interface BcBet {
  _id: string;
  bcBetId: string;
  bcTransactionId: string;
  bcAmount: number;
  bcTotalPrice: number | null;
  bcAmountPaid: number;
  bcSelections: BcSelection[];
  status: "OPEN" | "WON" | "LOST" | "RETURNED" | "CASHED_OUT" | "VOID";
  createdAt: string;
  settledAt: string | null;
}

interface PaginatedBets {
  data: BcBet[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BcBet["status"], string> = {
  OPEN:       "bg-blue-100   text-blue-700   border-blue-200",
  WON:        "bg-emerald-100 text-emerald-700 border-emerald-200",
  LOST:       "bg-red-100    text-red-700    border-red-200",
  RETURNED:   "bg-amber-100  text-amber-700  border-amber-200",
  CASHED_OUT: "bg-purple-100 text-purple-700 border-purple-200",
  VOID:       "bg-slate-100  text-slate-600  border-slate-200",
};

function StatusBadge({ status }: { status: BcBet["status"] }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase border ${STATUS_STYLES[status] ?? STATUS_STYLES.VOID}`}>
      {status}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientBetsPage() {
  const router = useRouter();
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();

  const [activeTab, setActiveTab] = useState<"open" | "settled">("open");
  const [bets, setBets] = useState<BcBet[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth guard — wait for hydration before redirecting
  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, _hasHydrated, router]);

  const fetchBets = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        activeTab === "open"
          ? `/client/bets/unsettled?page=${page}&limit=20`
          : `/client/bets/history?page=${page}&limit=20`;

      const res = await api.get(endpoint);
      // unsettled returns { data: [...] }, history returns { data: [...], pagination: {} }
      setBets(res.data.data ?? []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load bets.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isAuthenticated) fetchBets(1);
  }, [activeTab, isAuthenticated, fetchBets]);

  if (!isAuthenticated || !user) return null;

  return (
    <DashboardLayout accountType="CLIENT" username={user.username} balance={user.balance} exposure={0}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Page header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            My Bets
          </h1>
          <button
            onClick={() => fetchBets(pagination.page)}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-colors"
            style={{ backgroundColor: "var(--teal)", color: "#fff" }}
          >
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div
          className="flex overflow-hidden rounded"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          {(["open", "settled"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 px-6 py-3 text-sm font-bold uppercase tracking-wide transition-colors"
              style={{
                backgroundColor: activeTab === tab ? "var(--teal)" : "transparent",
                color:           activeTab === tab ? "#fff"        : "var(--text-secondary)",
                borderRight:     tab === "open"    ? "1px solid var(--border)" : undefined,
              }}
            >
              {tab === "open" ? "Open / Unsettled" : "Settled History"}
            </button>
          ))}
        </div>

        {/* ── Table ─────────────────────────────────────────────────── */}
        <div
          className="rounded overflow-hidden shadow-sm"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          {/* Error */}
          {error && (
            <div className="p-6 text-center text-red-500 bg-red-50">
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="p-12 text-center" style={{ color: "var(--text-muted)" }}>
              <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading bets...
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "var(--teal)", color: "#fff" }}>
                    <th className="px-4 py-3 font-semibold">Date Placed</th>
                    <th className="px-4 py-3 font-semibold">Bet ID</th>
                    <th className="px-4 py-3 font-semibold">Selections</th>
                    <th className="px-4 py-3 font-semibold text-right">Odds</th>
                    <th className="px-4 py-3 font-semibold text-right">Stake</th>
                    <th className="px-4 py-3 font-semibold text-right">Winnings</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody style={{ borderTop: "1px solid var(--border)" }}>
                  {bets.map((bet) => {
                    // Build a human-readable selection summary from bcSelections
                    const selectionLabel =
                      bet.bcSelections.length > 0
                        ? bet.bcSelections
                            .map((s) =>
                              [s.EventName, s.MarketName, s.RunnerName]
                                .filter(Boolean)
                                .join(" › ")
                            )
                            .join(" | ")
                        : `Bet #${bet.bcBetId}`;

                    return (
                      <tr
                        key={bet._id}
                        className="transition-colors hover:brightness-95"
                        style={{ borderBottom: "1px solid var(--border-light)" }}
                      >
                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          <div className="text-xs">
                            {new Date(bet.createdAt).toLocaleDateString(undefined, {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </div>
                          <div className="text-xs opacity-70">
                            {new Date(bet.createdAt).toLocaleTimeString(undefined, {
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </div>
                        </td>

                        {/* Bet ID */}
                        <td className="px-4 py-3">
                          <span
                            className="font-mono text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                            title={`Transaction: ${bet.bcTransactionId}`}
                          >
                            #{bet.bcBetId}
                          </span>
                        </td>

                        {/* Selections */}
                        <td className="px-4 py-3 font-medium max-w-xs" style={{ color: "var(--text-primary)" }}>
                          <span className="line-clamp-2 text-xs leading-relaxed" title={selectionLabel}>
                            {selectionLabel}
                          </span>
                        </td>

                        {/* Odds (bcTotalPrice = combined decimal odds) */}
                        <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: "var(--back-blue)" }}>
                          {bet.bcTotalPrice != null ? bet.bcTotalPrice.toFixed(2) : "—"}
                        </td>

                        {/* Stake (bcAmount) */}
                        <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                          {bet.bcAmount.toFixed(2)}
                        </td>

                        {/* Winnings (bcAmountPaid — 0 for open/lost) */}
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          <span
                            style={{
                              color: bet.bcAmountPaid > 0 ? "var(--emerald, #059669)" : "var(--text-muted)",
                            }}
                          >
                            {bet.bcAmountPaid > 0 ? `+${bet.bcAmountPaid.toFixed(2)}` : "—"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={bet.status} />
                        </td>
                      </tr>
                    );
                  })}

                  {bets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center" style={{ color: "var(--text-muted)" }}>
                        No {activeTab === "open" ? "open" : "settled"} bets found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ─────────────────────────────────────────── */}
          {!loading && pagination.totalPages > 1 && (
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <span className="text-xs">
                Showing {bets.length} of {pagination.total} bets
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchBets(pagination.page - 1)}
                  className="px-3 py-1 rounded text-xs font-bold disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
                >
                  ← Prev
                </button>
                <span className="px-3 py-1 text-xs">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchBets(pagination.page + 1)}
                  className="px-3 py-1 rounded text-xs font-bold disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
