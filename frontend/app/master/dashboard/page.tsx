"use client";

/** @page /app/master/dashboard/page.tsx — Dark Teal theme */

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/ui/StatCard";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

interface Client {
  id: string; username: string; balance: number;
  activeBets: number; pl: number; status: "ACTIVE" | "SUSPENDED"; joinedAt: string;
}

// TODO: Replace with real client-level bet fetch when built
interface ClientBet {
  id: string; clientName: string; match: string; selection: string;
  type: "BACK" | "LAY"; stake: number; odds: number; potentialPayout: number;
  status: "OPEN" | "WON" | "LOST" | "VOID"; placedAt: string;
}
const MOCK_BETS: ClientBet[] = [];

const betStatusColors: Record<string, string> = {
  OPEN: "var(--teal)", WON: "var(--success)", LOST: "var(--danger)", VOID: "var(--text-muted)",
};
const clientStatusColors: Record<string, string> = {
  ACTIVE: "var(--success)", SUSPENDED: "var(--danger)",
};

export default function MasterDashboardPage() {
  const { user } = useAuthStore();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [activeTab, setActiveTab] = useState<"clients" | "bets">("clients");

  useEffect(() => {
    let isMounted = true;
    const fetchClients = async () => {
      try {
        const response = await api.get("/master/clients");
        if (isMounted) {
          setClients(response.data.data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch clients:", err);
        if (isMounted) setLoading(false);
      }
    };
    fetchClients();
    return () => { isMounted = false; };
  }, []);

  const closeModal = () => { setSelectedClient(null); setTransferAmount(""); setTransferSuccess(false); setTransferError(""); };
  
  const totalCoins = clients.reduce((a, c) => a + c.balance, 0);
  const activeBets = clients.reduce((a, c) => a + c.activeBets, 0);

  return (
    <DashboardLayout accountType="MASTER" username={user?.username || "Agent"} balance={user?.balance || 0} exposure={0}>
      <div className="mb-5">
        <h1 className="text-lg font-bold">Agent Dashboard</h1>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Manage clients and oversee betting activity.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard title="My Balance" value={`${(user?.balance || 0).toLocaleString()} VC`} accentColor="teal"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard title="Total Clients" value={clients.length} accentColor="teal"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard title="Coins Distributed" value={`${totalCoins.toLocaleString()} VC`} accentColor="green"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
        />
        <StatCard title="Active Bets" value={activeBets} accentColor="amber"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-3 rounded overflow-hidden w-fit" style={{ border: "1px solid var(--border)" }}>
        {(["clients", "bets"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-5 py-2 text-xs font-bold uppercase tracking-wide transition-colors"
            style={{ backgroundColor: activeTab === tab ? "var(--teal)" : "var(--bg-surface)", color: activeTab === tab ? "#fff" : "var(--text-secondary)" }}>
            {tab === "clients" ? "My Clients" : "Client Bets"}
          </button>
        ))}
      </div>

      {/* Clients Table */}
      {activeTab === "clients" && (
        <div className="rounded overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                  {["Client", "Balance", "Active Bets", "P&L", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold uppercase tracking-wide" style={{ color: "var(--teal-light)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-6 text-slate-400">Loading clients...</td></tr>
                ) : clients.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-slate-400">No active clients found.</td></tr>
                ) : (
                  clients.map((client, i) => (
                    <tr key={client.id} style={{ backgroundColor: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)", borderTop: "1px solid var(--border-light)" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black" style={{ backgroundColor: "var(--teal)" }}>
                            {client.username.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-800">{client.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums text-slate-900">
                        {client.balance.toLocaleString()} <span style={{ color: "var(--text-muted)" }}>VC</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{client.activeBets}</td>
                      <td className="px-4 py-3 font-bold tabular-nums" style={{ color: client.pl >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {client.pl >= 0 ? "+" : ""}{client.pl.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-sm"
                          style={{ color: clientStatusColors[client.status], backgroundColor: `${clientStatusColors[client.status]}20` }}>
                          {client.status}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{client.joinedAt}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedClient(client)}
                          className="text-xs font-bold px-3 py-1 rounded-sm text-black hover:bg-teal-400 transition-colors"
                          style={{ backgroundColor: "var(--teal)" }}>
                          Transfer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bets Table */}
      {activeTab === "bets" && (
        <div className="rounded overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                  {["Client", "Match", "Selection", "Type", "Stake", "Odds", "Payout", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold uppercase tracking-wide" style={{ color: "var(--teal-light)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_BETS.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-6 text-slate-400">No recent bets found.</td></tr>
                ) : (
                  MOCK_BETS.map((bet, i) => {
                    const isBack = bet.type === "BACK";
                    return (
                      <tr key={bet.id} style={{ backgroundColor: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)", borderTop: "1px solid var(--border-light)" }}>
                        <td className="px-4 py-3 font-bold text-slate-800">{bet.clientName}</td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{bet.match}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{bet.selection}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-xs px-1.5 py-0.5 rounded-sm"
                            style={{ backgroundColor: isBack ? "var(--back-blue-bg)" : "var(--lay-pink-bg)", color: isBack ? "var(--back-blue)" : "var(--lay-pink)" }}>
                            {bet.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-secondary)" }}>{bet.stake.toLocaleString()}</td>
                        <td className="px-4 py-3 tabular-nums font-bold" style={{ color: isBack ? "var(--back-blue)" : "var(--lay-pink)" }}>{bet.odds}</td>
                        <td className="px-4 py-3 tabular-nums font-bold" style={{ color: "var(--success)" }}>{bet.potentialPayout.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-xs" style={{ color: betStatusColors[bet.status] }}>{bet.status}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      <Modal isOpen={!!selectedClient} onClose={closeModal} title={`Transfer Coins — ${selectedClient?.username ?? ""}`}>
        {transferSuccess ? (
          <div className="text-center py-4">
            <p className="font-bold text-lg" style={{ color: "var(--success)" }}>✓ Transfer Successful</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{transferAmount} VC sent to {selectedClient?.username}</p>
            <button onClick={closeModal} className="mt-5 w-full py-2.5 rounded text-sm font-bold text-black hover:bg-teal-400 transition-colors" style={{ backgroundColor: "var(--teal)" }}>Done</button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedClient || !transferAmount) return;
            const amt = parseFloat(transferAmount);
            if (amt <= 0 || amt > (user?.balance || 0)) return;

            setTransferLoading(true);
            setTransferError("");
            try {
              const res = await api.post("/master/transfer", { clientId: selectedClient.id, amount: amt });
              // Update master's local Zustand balance directly
              if (user && res.data.newBalance !== undefined) {
                useAuthStore.getState().login({ ...user, balance: res.data.newBalance }, useAuthStore.getState().token || "");
              }
              // Immediately refetch clients list to reflect new child balance
              const clientsRes = await api.get("/master/clients");
              setClients(clientsRes.data.data);
              
              setTransferSuccess(true);
            } catch (err: any) {
              setTransferError(err.response?.data?.error || "Transfer failed");
            } finally {
              setTransferLoading(false);
            }
          }}>
            {transferError && (
              <div className="mb-4 text-xs px-3 py-2.5 rounded bg-red-500/10 text-red-500 border border-red-500/30">
                {transferError}
              </div>
            )}
            <div className="flex gap-3">
              <div className="flex-1 p-3 rounded text-center" style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs mb-0.5" style={{ color: "var(--teal-dark)" }}>Client Balance</p>
                <p className="font-bold text-slate-900 tabular-nums">{selectedClient?.balance.toLocaleString()} VC</p>
              </div>
              <div className="flex-1 p-3 rounded text-center" style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs mb-0.5" style={{ color: "var(--teal-dark)" }}>My Balance</p>
                <p className="font-bold text-slate-900 tabular-nums">{(user?.balance || 0).toLocaleString()} VC</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--teal-light)" }}>Amount</label>
              <input type="number" min="1" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Enter amount…" className="w-full px-3 py-2.5 text-sm rounded transition-colors"
                style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {[1000, 5000, 10000, 25000].map((amt) => (
                  <button type="button" key={amt} onClick={() => setTransferAmount(String(amt))}
                    className="text-xs px-2.5 py-1 rounded-sm hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    {(amt / 1000).toFixed(0)}K
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={!parseFloat(transferAmount) || parseFloat(transferAmount) > (user?.balance || 0) || transferLoading}
              className="w-full py-2.5 rounded text-sm font-bold text-black transition-opacity"
              style={{ backgroundColor: "var(--teal)", opacity: (parseFloat(transferAmount) > 0 && parseFloat(transferAmount) <= (user?.balance || 0) && !transferLoading) ? 1 : 0.5 }}>
              {transferLoading ? "Processing..." : "Confirm Transfer"}
            </button>
          </form>
        )}
      </Modal>
    </DashboardLayout>
  );
}
