"use client";

/** @page /app/admin/dashboard/page.tsx — Dark Teal theme */

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/ui/StatCard";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

interface Master {
  _id: string; username: string; email: string;
  balance: number; clientCount: number; isActive: boolean; createdAt: string;
}

export default function AdminDashboardPage() {
  const { user, login } = useAuthStore();
  
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);

  // Mint State
  const [mintOpen, setMintOpen] = useState(false);
  const [mintAmount, setMintAmount] = useState("");
  const [mintTarget, setMintTarget] = useState("");
  const [mintSuccess, setMintSuccess] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);
  const [mintError, setMintError] = useState("");

  // Create Master State
  const [createOpen, setCreateOpen] = useState(false);
  const [newMaster, setNewMaster] = useState({ username: "", email: "", password: "", initialBalance: "" });
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchMasters = async () => {
    try {
      const response = await api.get("/admin/masters");
      setMasters(response.data.data);
    } catch (err) {
      console.error("Failed to fetch masters:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  const closeMint = () => { setMintOpen(false); setMintAmount(""); setMintTarget(""); setMintSuccess(false); setMintError(""); };
  const closeCreate = () => { setCreateOpen(false); setNewMaster({ username: "", email: "", password: "", initialBalance: "" }); setCreateSuccess(false); setCreateError(""); };

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mintAmount) return;
    setMintLoading(true); setMintError("");
    try {
      const payload: any = { amount: parseFloat(mintAmount) };
      if (mintTarget.trim() !== "") payload.targetMasterUsername = mintTarget.trim();

      const res = await api.post("/admin/mint", payload);
      
      // Update local wallet if minted to treasury (self)
      if (!payload.targetMasterUsername && user) {
         login({ ...user, balance: res.data.data.newBalance }, useAuthStore.getState().token || "");
      }
      
      setMintSuccess(true);
      fetchMasters(); // Refetch balances
    } catch (err: any) {
      setMintError(err.response?.data?.error || "Failed to mint coins.");
    } finally {
      setMintLoading(false);
    }
  };

  const handleCreateMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaster.username || !newMaster.email || !newMaster.password) return;
    setCreateLoading(true); setCreateError("");
    try {
      const payload = {
        username: newMaster.username,
        email: newMaster.email,
        password: newMaster.password,
        initialBalance: newMaster.initialBalance ? parseFloat(newMaster.initialBalance) : 0
      };
      await api.post("/admin/masters", payload);
      setCreateSuccess(true);
      
      // If we deducted balance for initial funding, update locally
      if (payload.initialBalance > 0 && user) {
        login({ ...user, balance: user.balance - payload.initialBalance }, useAuthStore.getState().token || "");
      }
      
      fetchMasters();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || "Failed to create master.");
    } finally {
      setCreateLoading(false);
    }
  };

  // Aggregates
  const treasuryBalance = user?.balance || 0;
  // Technically this logic should hit a backend stats endpoint later, but for UI sake mapping what we have
  const totalCirculation = masters.reduce((a, m) => a + m.balance, 0); 
  const totalPlatformCoins = treasuryBalance + totalCirculation;

  return (
    <DashboardLayout accountType="MAIN" username={user?.username || "admin"} balance={treasuryBalance} exposure={0}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg font-bold">Platform Oversight</h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Manage the virtual coin economy and master agents.</p>
        </div>
        <button
          onClick={() => setMintOpen(true)}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded text-black uppercase tracking-wide hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "var(--teal)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Mint New Coins
        </button>
      </div>

      {/* Economy Banner */}
      <div className="rounded-lg p-5 mb-5 shadow-xl" style={{ backgroundColor: "var(--teal)", background: "linear-gradient(135deg, #1d8097 0%, #26a0b5 50%, #2dbdd6 100%)" }}>
        <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-1">Total System Economics</p>
        <p className="text-4xl font-black text-white tabular-nums">
          {totalPlatformCoins.toLocaleString()} <span className="text-2xl font-medium opacity-75">VC</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-8">
          {[
            { label: "Treasury (Your Balance)", value: `${treasuryBalance.toLocaleString()} VC` },
            { label: "In Circulation (Masters)", value: `${totalCirculation.toLocaleString()} VC` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-white/60">{label}</p>
              <p className="text-xl font-bold text-white tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard title="Active Masters" value={masters.filter((m) => m.isActive === true).length} accentColor="teal"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        />
        <StatCard title="Suspended Masters" value={masters.filter((m) => m.isActive === false).length} accentColor="red"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
      </div>

      {/* Masters Table */}
      <div className="rounded overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "var(--teal)", borderBottom: "1px solid rgba(0,0,0,0.2)" }}>
          <h2 className="text-xs font-bold text-white uppercase tracking-wide">Master Agent Accounts</h2>
          <button
            onClick={() => setCreateOpen(true)}
            className="text-xs font-bold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded transition-colors"
          >
            + Create Master
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                {["Master", "Balance", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold uppercase tracking-wide" style={{ color: "var(--teal-light)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-6 text-slate-400">Loading masters...</td></tr>
              ) : masters.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-slate-400">No Master accounts found. Create one.</td></tr>
              ) : (
                masters.map((master, i) => (
                  <tr key={master._id} style={{ backgroundColor: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)", borderTop: "1px solid var(--border-light)" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-purple-500 text-white">
                          {master.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{master.username}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{master.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums text-slate-900">{master.balance.toLocaleString()} <span style={{ color: "var(--text-muted)" }}>VC</span></td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-xs px-2 py-0.5 rounded-sm bg-opacity-20" style={{ color: master.isActive ? "var(--success)" : "var(--danger)", backgroundColor: master.isActive ? "rgba(76, 175, 80, 0.1)" : "rgba(244, 67, 54, 0.1)" }}>
                        {master.isActive ? "ACTIVE" : "SUSPENDED"}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{new Date(master.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="text-xs font-bold px-2.5 py-1 rounded-sm hover:opacity-80 transition-opacity" style={{ color: master.isActive ? "var(--danger)" : "var(--success)", border: master.isActive ? "1px solid var(--danger)" : "1px solid var(--success)" }}
                          onClick={async () => {
                            await api.put(`/admin/masters/${master._id}/status`, { isActive: !master.isActive });
                            fetchMasters();
                          }}>
                          {master.isActive ? "Suspend" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mint Modal */}
      <Modal isOpen={mintOpen} onClose={closeMint} title="Mint New Virtual Coins">
        {mintSuccess ? (
          <div className="text-center py-4">
            <p className="text-lg font-bold" style={{ color: "var(--success)" }}>✓ Coins Minted!</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{mintAmount} VC successfully generated.</p>
            <button onClick={closeMint} className="mt-5 w-full py-2.5 rounded text-sm font-bold text-black" style={{ backgroundColor: "var(--teal)" }}>Done</button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleMint}>
            <div className="text-xs p-3 rounded" style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning)", border: "1px solid rgba(255,152,0,0.3)" }}>
              <p className="font-bold">⚠ Super Admin Action</p>
              <p className="mt-0.5 opacity-80">Minting increases total supply. Action is logged and irreversible.</p>
            </div>
            {mintError && (
              <div className="text-xs p-3 rounded bg-red-500/10 text-red-500 border border-red-500/30 font-semibold">{mintError}</div>
            )}
            
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--teal-light)" }}>Amount to Mint</label>
              <input type="number" min="1" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} placeholder="e.g. 100000"
                className="w-full px-3 py-2.5 text-sm rounded transition-colors"
                style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {[10_000, 50_000, 100_000, 500_000].map((amt) => (
                  <button type="button" key={amt} onClick={() => setMintAmount(String(amt))}
                    className="text-xs px-2.5 py-1 rounded-sm hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    {(amt / 1000).toFixed(0)}K
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--teal-light)" }}>Target Master Username (Optional)</label>
              <input type="text" value={mintTarget} onChange={(e) => setMintTarget(e.target.value)} placeholder="Leave blank to mint to Treasury"
                className="w-full px-3 py-2.5 text-sm rounded transition-colors"
                style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <p className="text-[10px] opacity-70 mt-1 pl-1">If provided, coins will skip treasury and instantly fund this user.</p>
            </div>

            <button type="submit" disabled={!parseFloat(mintAmount) || mintLoading}
              className="w-full py-2.5 rounded text-sm font-bold text-black transition-opacity"
              style={{ backgroundColor: "var(--teal)", opacity: (parseFloat(mintAmount) > 0 && !mintLoading) ? 1 : 0.5 }}>
              {mintLoading ? "Minting Engine..." : "Confirm Mint"}
            </button>
          </form>
        )}
      </Modal>

      {/* Create Master Modal */}
      <Modal isOpen={createOpen} onClose={closeCreate} title="Create New Master Account">
        {createSuccess ? (
          <div className="text-center py-4">
            <p className="text-lg font-bold" style={{ color: "var(--success)" }}>✓ Master Created!</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>@{newMaster.username} can now log in.</p>
            <button onClick={closeCreate} className="mt-5 w-full py-2.5 rounded text-sm font-bold text-black" style={{ backgroundColor: "var(--teal)" }}>Done</button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleCreateMaster}>
            {createError && (
              <div className="text-xs p-3 rounded bg-red-500/10 text-red-500 border border-red-500/30 font-semibold">{createError}</div>
            )}
            {[
              { label: "Username", key: "username", type: "text", placeholder: "master_agent" },
              { label: "Email", key: "email", type: "email", placeholder: "agent@example.com" },
              { label: "Password", key: "password", type: "password", placeholder: "Minimum 8 characters" },
              { label: "Initial Balance (VC) [Deducts from Treasury]", key: "initialBalance", type: "number", placeholder: "e.g. 25000" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--teal-light)" }}>{label}</label>
                <input type={type} value={newMaster[key as keyof typeof newMaster]}
                  onChange={(e) => setNewMaster((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder} className="w-full px-3 py-2.5 text-sm rounded focus:ring-1 focus:ring-[var(--teal)] transition-colors"
                  style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)", outline: "none" }} />
              </div>
            ))}
            <button type="submit" disabled={!newMaster.username || !newMaster.email || !newMaster.password || createLoading}
              className="w-full py-2.5 rounded text-sm font-bold text-black transition-opacity"
              style={{ backgroundColor: "var(--teal)", opacity: (newMaster.username && newMaster.email && newMaster.password && !createLoading) ? 1 : 0.5 }}>
              {createLoading ? "Provisioning..." : "Create Master Account"}
            </button>
          </form>
        )}
      </Modal>
    </DashboardLayout>
  );
}
