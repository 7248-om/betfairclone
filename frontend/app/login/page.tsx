"use client";

/**
 * @page /app/login/page.tsx — Dark Teal theme
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore, User } from "@/store/useAuthStore";

export default function LoginPage() {
  const router = useRouter();
  const loginAction = useAuthStore((state) => state.login);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const response = await api.post("/auth/login", { username, password });
      const { user, token } = response.data;
      
      // Save directly to persistent Zustand store
      loginAction(user, token);

      // Redirect strictly based on their backend-validated role
      if (user.accountType === "CLIENT") {
        router.push("/client/dashboard");
      } else if (user.accountType === "MASTER") {
        router.push("/master/dashboard");
      } else if (user.accountType === "MAIN") {
        router.push("/admin/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to login. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="w-full max-w-sm">
        {/* Logo card */}
        <div
          className="rounded-lg overflow-hidden shadow-2xl"
          style={{ border: "1px solid var(--border)" }}
        >
          {/* Header */}
          <div className="py-5 px-6 text-center" style={{ backgroundColor: "var(--teal)" }}>
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2 font-black text-xl text-white">
              SC
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">
              STAKE<span className="opacity-80">CLONE</span>
            </h1>
            <p className="text-xs text-white/70 mt-0.5">Private invite-only platform</p>
          </div>

          {/* Form body */}
          <div className="px-6 py-6" style={{ backgroundColor: "var(--bg-surface)" }}>
            <h2 className="text-sm font-bold text-white mb-5 uppercase tracking-wide">Sign In to Your Account</h2>

            {error && (
              <div
                className="mb-4 text-xs px-3 py-2.5 rounded"
                style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)", border: "1px solid rgba(244,67,54,0.3)" }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--teal-light)" }}>
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                  placeholder="your_username"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--teal-light)" }}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded text-sm font-bold text-white uppercase tracking-wide transition-opacity"
                style={{ backgroundColor: loading ? "var(--teal-dark)" : "var(--teal)", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Signing in…" : "Login"}
              </button>
            </form>

            <p className="text-xs text-center mt-5" style={{ color: "var(--text-muted)" }}>
              Access is by invitation only. Contact your agent to register.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
