"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuthStore } from "@/store/useAuthStore";
import { api } from "@/lib/api";

type Tab = "statement" | "pnl" | "history" | "unsettled" | "stake" | "rules" | "password" | "results";

export default function ClientAccountPage() {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("statement");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Read query param if passed
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab") as Tab;
      if (tabParam) setActiveTab(tabParam);
    }
  }, []);

  useEffect(() => {
    fetchTabData();
  }, [activeTab]);

  const fetchTabData = async () => {
    setLoading(true);
    setData(null);
    try {
      if (activeTab === "statement") {
        const res = await api.get("/client/statement");
        setData(res.data.data);
      } else if (activeTab === "pnl") {
        const res = await api.get("/client/profit-loss");
        setData(res.data.data);
      } else if (activeTab === "history") {
        const res = await api.get("/client/bets/history");
        setData(res.data.data);
      } else if (activeTab === "unsettled") {
        const res = await api.get("/client/bets/unsettled");
        setData(res.data.data);
      } else if (activeTab === "stake") {
        // Form state handles this
        setData({ stakes: user?.stakePreferences || [100, 500, 1000, 5000] });
      }
    } catch (err) {
      console.error("Failed to load tab data", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Forms State ---
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [stakeForm, setStakeForm] = useState<number[]>(user?.stakePreferences || [100, 500, 1000, 5000]);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ type: "info", text: "Updating..." });
    try {
      await api.put("/client/password", passwordForm);
      setMsg({ type: "success", text: "Password updated successfully! Please log in again." });
      setTimeout(() => logout(), 2000);
    } catch (err: any) {
      setMsg({ type: "error", text: err.response?.data?.error || "Error updating password." });
    }
  };

  const handleUpdateStakes = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ type: "info", text: "Updating..." });
    try {
      const res = await api.put("/client/preferences/stakes", { stakes: stakeForm });
      setMsg({ type: "success", text: "Stake preferences updated!" });
      useAuthStore.getState().user!.stakePreferences = res.data.data.stakePreferences;
    } catch (err: any) {
      setMsg({ type: "error", text: err.response?.data?.error || "Error updating stakes." });
    }
  };

  // Menu items array mirroring the user's screenshot
  const menuItems: { id: Tab; label: string; icon: string }[] = [
    { id: "statement", label: "Account Statement", icon: "🧾" },
    { id: "pnl", label: "Profit Loss Report", icon: "📊" },
    { id: "history", label: "Bet History", icon: "📜" },
    { id: "unsettled", label: "Unsettled Bet", icon: "📋" },
    { id: "stake", label: "Set Stake", icon: "👆" },
    { id: "rules", label: "Rules", icon: "⚖️" },
    { id: "password", label: "Change Password", icon: "🔒" },
    { id: "results", label: "Results", icon: "✅" },
  ];

  return (
    <DashboardLayout accountType="CLIENT" username={user?.username || "Guest"} balance={user?.balance || 0} exposure={0}>
      <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
        
        {/* --- LEFT SIDEBAR (Menu) --- */}
        <div className="w-full md:w-72 flex-shrink-0">
          
          {/* Profile Card */}
          <div className="text-white rounded-t-lg p-4" style={{ backgroundColor: "#015E6D" }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-yellow-400 text-lg">👤</span>
              <span className="font-bold">{user?.username} - (86)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded border border-white/20" style={{ backgroundColor: "#22A6B3" }}>
                <p className="text-xs font-semibold mb-1">Exposure</p>
                <p className="font-mono text-sm">0.00</p>
              </div>
              <div className="p-2 rounded border border-white/20" style={{ backgroundColor: "#22A6B3" }}>
                <p className="text-xs font-semibold mb-1">P&L</p>
                <p className="font-mono text-sm text-red-200">-8814.00</p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="rounded-b-lg pb-4" style={{ backgroundColor: "#015E6D" }}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setMsg({ type:"", text:"" }); }}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  activeTab === item.id 
                    ? "bg-black/20 border-l-4 border-teal-400 text-white" 
                    : "hover:bg-white/10 border-l-4 border-transparent text-white/90"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium text-sm drop-shadow-md">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* --- RIGHT CONTENT AREA --- */}
        <div className="flex-1 bg-white rounded-lg shadow-md border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-6 uppercase tracking-wider border-b pb-2">
            {menuItems.find(i => i.id === activeTab)?.label}
          </h2>

          {msg.text && (
            <div className={`p-4 rounded-md mb-6 ${
              msg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
              : msg.type === "info" ? "bg-blue-50 text-blue-700 border border-blue-200"
              : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {msg.text}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading data...</div>
          ) : (
            <div className="content-area">
              
              {/* TAB: STATEMENT */}
              {activeTab === "statement" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data?.map((tx: any) => (
                        <tr key={tx._id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {tx.description || tx.type}
                          </td>
                          <td className={`px-4 py-3 font-mono font-bold ${tx.amount > 0 && tx.type !== "BET_PLACED" ? "text-emerald-600" : "text-red-500"}`}>
                            {tx.type === "BET_PLACED" ? "-" : "+"}{tx.amount}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                            {tx.runningBalance}
                          </td>
                        </tr>
                      ))}
                      {!data?.length && (
                        <tr><td colSpan={4} className="text-center py-8 text-slate-500">No transactions found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB: PNL */}
              {activeTab === "pnl" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded">
                    <p className="text-sm text-slate-500 mb-1">Total Staked</p>
                    <p className="text-2xl font-bold text-slate-800">{data?.totalStaked || 0} VC</p>
                  </div>
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded">
                    <p className="text-sm text-slate-500 mb-1">Total Winnings</p>
                    <p className="text-2xl font-bold text-emerald-600">{data?.totalWinnings || 0} VC</p>
                  </div>
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded">
                    <p className="text-sm text-slate-500 mb-1">Total Refunds</p>
                    <p className="text-2xl font-bold text-blue-600">{data?.totalRefunds || 0} VC</p>
                  </div>
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded">
                    <p className="text-sm text-slate-500 mb-1">Net P&L</p>
                    <p className={`text-2xl font-bold ${data?.netPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {data?.netPnl || 0} VC
                    </p>
                  </div>
                </div>
              )}

              {/* TAB: HISTORY & UNSETTLED */}
              {(activeTab === "history" || activeTab === "unsettled") && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse border border-slate-200">
                    <thead className="bg-[#00A5B5] text-white">
                      <tr>
                        <th className="px-3 py-2 border border-slate-200">Market</th>
                        <th className="px-3 py-2 border border-slate-200">Selection</th>
                        <th className="px-3 py-2 border border-slate-200">Type</th>
                        <th className="px-3 py-2 border border-slate-200 text-right">Odds</th>
                        <th className="px-3 py-2 border border-slate-200 text-right">Stake</th>
                        <th className="px-3 py-2 border border-slate-200 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data?.map((bet: any) => (
                        <tr key={bet._id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 border border-slate-200">
                            <span className="font-semibold block">{bet.match?.eventName || "Deleted Match"}</span>
                            <span className="text-xs text-slate-500">{new Date(bet.createdAt).toLocaleString()}</span>
                          </td>
                          <td className="px-3 py-2 border border-slate-200 font-bold text-slate-800">
                            {bet.selectedRunnerName}
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-center">
                             <span className="bg-[#C5DBE7] text-slate-800 px-2 py-0.5 rounded text-xs font-bold">BACK</span>
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-mono font-bold">
                            {bet.oddsAtPlacement}
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-mono font-bold">
                            {bet.stake}
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-center">
                            {bet.status === "OPEN" ? (
                              <span className="text-blue-600 font-bold text-xs uppercase bg-blue-100 px-2 py-1 rounded">Open</span>
                            ) : bet.status === "WON" ? (
                              <span className="text-emerald-600 font-bold text-xs uppercase bg-emerald-100 px-2 py-1 rounded">Won</span>
                            ) : bet.status === "LOST" ? (
                              <span className="text-red-600 font-bold text-xs uppercase bg-red-100 px-2 py-1 rounded">Lost</span>
                            ) : (
                              <span className="text-slate-600 font-bold text-xs uppercase bg-slate-100 px-2 py-1 rounded">{bet.status}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!data?.length && (
                        <tr><td colSpan={6} className="text-center py-8 text-slate-500">No bets found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB: SET STAKE */}
              {activeTab === "stake" && (
                <form onSubmit={handleUpdateStakes} className="max-w-md mx-auto space-y-4">
                  <p className="text-sm text-slate-500 mb-4">Customize your quick-bet buttons to quickly set your stake amounts.</p>
                  
                  {stakeForm.map((amount, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <label className="text-sm font-bold text-slate-700 w-24">Button {idx + 1}</label>
                      <input
                        type="number"
                        min="1"
                        value={amount}
                        onChange={(e) => {
                          const ns = [...stakeForm];
                          ns[idx] = Number(e.target.value);
                          setStakeForm(ns);
                        }}
                        className="flex-1 border p-2 rounded focus:ring-1 focus:ring-teal-500 outline-none"
                      />
                      {idx > 0 && (
                        <button type="button" onClick={() => setStakeForm(stakeForm.filter((_, i) => i !== idx))} className="text-red-500 px-2">✕</button>
                      )}
                    </div>
                  ))}
                  
                  {stakeForm.length < 8 && (
                    <button type="button" onClick={() => setStakeForm([...stakeForm, 100])} className="text-teal-600 font-bold text-sm w-full py-2 border border-dashed border-teal-300 rounded bg-teal-50 hover:bg-teal-100">
                      + Add Button
                    </button>
                  )}

                  <button type="submit" className="w-full bg-[#015E6D] text-white py-3 rounded font-bold uppercase mt-6 hover:bg-[#014955] transition-colors">
                    Save Stakes
                  </button>
                </form>
              )}

              {/* TAB: PASSWORD */}
              {activeTab === "password" && (
                <form onSubmit={handleUpdatePassword} className="max-w-md mx-auto space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Current Password</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full border p-2 rounded focus:ring-1 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full border p-2 rounded focus:ring-1 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full bg-[#015E6D] text-white py-3 rounded font-bold uppercase mt-4 hover:bg-[#014955] transition-colors">
                    Change Password
                  </button>
                </form>
              )}

              {/* TAB: RULES & RESULTS (static placeholders for UI consistency) */}
              {(activeTab === "rules" || activeTab === "results") && (
                <div className="py-12 text-center text-slate-500 border border-dashed rounded bg-slate-50">
                  <p className="font-bold mb-2">This module is currently in development.</p>
                  <p className="text-sm">Please check back later or contact your Master Agent.</p>
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
