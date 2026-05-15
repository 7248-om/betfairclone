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
  const { user, token, isAuthenticated } = useAuthStore();

  // Guard: redirect to login if the session has expired or the user
  // navigated directly to this URL without being authenticated.
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  // Render nothing while the redirect is in flight to avoid a flash of
  // the layout before the navigation completes.
  if (!isAuthenticated || !user) return null;

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
