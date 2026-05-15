"use client";

/**
 * @page /app/client/casino/page.tsx
 * @description Client Casino — BetConstruct Casino iFrame (3.1.4)
 *
 * Renders the full-height Casino iFrame inside DashboardLayout.
 * The user's JWT is passed as `token` so BC can call our
 * /api/casino/* wallet endpoints using it as `Token`.
 *
 * Auth guard: redirects to /login if not authenticated.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import CasinoIframe from "@/components/CasinoIframe";
import { useAuthStore } from "@/store/useAuthStore";

export default function ClientCasinoPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, _hasHydrated } = useAuthStore();

  // Guard: only redirect once the persist middleware has finished reading
  // localStorage. Without _hasHydrated, the redirect fires before the stored
  // token is loaded, causing a flash-to-login on every page refresh.
  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, _hasHydrated, router]);

  // Render a themed loading screen while the auth store hydrates from
  // localStorage. This prevents the white-flash that occurs when the
  // component returns null before Zustand's persist middleware has rehydrated.
  // The background colour matches var(--bg-primary) so there is no jarring
  // contrast against the surrounding DashboardLayout.
  if (!isAuthenticated || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div
          className="text-sm tracking-widest uppercase opacity-50"
          style={{ color: "var(--text-primary)" }}
        >
          Loading Casino...
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      accountType="CLIENT"
      username={user.username}
      balance={user.balance}
      exposure={0}
    >
      {/*
       * Break out of DashboardLayout's inner padding (p-4 / p-6) with
       * negative margins so the iFrame fills the full remaining viewport.
       * h-[calc(100vh-48px)] subtracts the 48px (h-12) Navbar height.
       */}
      <div className="-mx-4 md:-mx-6 -mt-4 md:-mt-6">
        <CasinoIframe
          token={token}
          lang="en"
          mode="real"
          className="h-[calc(100vh-48px)] w-full"
        />
      </div>
    </DashboardLayout>
  );
}
