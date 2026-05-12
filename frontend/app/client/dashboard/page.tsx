"use client";

/**
 * @page /app/client/dashboard/page.tsx
 * @description Client Sportsbook — BetConstruct iFrame integration.
 *
 * ============================================================
 * ARCHITECTURE CHANGE (Betfair → BetConstruct)
 * ============================================================
 * This page previously rendered a custom match listing + BetSlip
 * component connected to the Betfair API via polling hooks.
 *
 * It now renders the BetConstruct Sportsbook iFrame which owns the
 * entire betting UI (markets, odds, bet slip). Our role is only to:
 *   1. Confirm the user is authenticated.
 *   2. Pass the JWT as `token` to the iFrame so BC can call our
 *      /api/bc/* endpoints using it as AuthToken.
 *
 * REMOVED:
 *   - useMatches, useLiveOdds, usePlaceBet hooks
 *   - BetSlip component
 *   - OddsButton, MatchCard local components
 *   - Sport tab bar
 *   - Match grid layout
 *
 * ADDED:
 *   - BetConstructIframe (full-height, full-width)
 *   - Redirect to /login if unauthenticated
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import BetConstructIframe from "@/components/BetConstructIframe";
import { useAuthStore } from "@/store/useAuthStore";

export default function ClientDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuthStore();

  // Guard: redirect to login if the user is not authenticated.
  // This runs client-side after hydration.
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  // Render nothing while the redirect is in flight
  if (!isAuthenticated || !user) return null;

  return (
    <DashboardLayout
      accountType="CLIENT"
      username={user.username}
      balance={user.balance}
      exposure={0}
    >
      {/*
       * The DashboardLayout wraps children in `pt-12 pl-48 p-4` padding.
       * We break out of the inner padding box with a negative-margin trick
       * so the iFrame can truly fill the remaining viewport.
       *
       * The iFrame height is `calc(100vh - 48px)` to account for the
       * 48px (h-12) Navbar. Adjust if the Navbar height changes.
       */}
      <div className="-mx-4 md:-mx-6 -mt-4 md:-mt-6">
        <BetConstructIframe
          token={token}
          lang="en"
          className="h-[calc(100vh-48px)] w-full"
        />
      </div>
    </DashboardLayout>
  );
}
