"use client";

/**
 * @component CasinoIframe
 * @description Embeds the BetConstruct Casino iFrame.
 *
 * ============================================================
 * HOW THE URL IS BUILT (Casino Integration API 3.1.4)
 * ============================================================
 * The base URL is defined in the environment:
 *   NEXT_PUBLIC_BC_CASINO_IFRAME_URL=https://casino.your-bc-partner.com/launch
 *
 * The following query parameters are appended per the 3.1.4 spec:
 *
 *   token       — Player's JWT (used by BC as `Token` in wallet API calls).
 *   partnerId   — Your BC Partner ID (from NEXT_PUBLIC_BC_PARTNER_ID).
 *   lang        — IETF language tag, e.g. 'en', 'de'. Default: 'en'.
 *   mode        — 'real' for real-money play, 'demo' for free play.
 *   gameSkinId  — (Optional) Numeric skin/theme ID for a specific game.
 *                 Pass this when launching a specific game title directly
 *                 (e.g., from a game lobby page) rather than the full lobby.
 *   currency    — (Optional) ISO 4217 currency code, e.g. 'USD'.
 *
 * Change `buildCasinoIframeSrc` below when BC provides the final URL spec.
 * All params are gracefully omitted when not provided.
 *
 * ============================================================
 * SECURITY NOTE
 * ============================================================
 * The `token` prop is the same JWT your backend issued at login.
 * BC's Casino backend will forward it to /api/casino/GetBalance (etc.)
 * as the `Token` field, which we decode with JWT_SECRET.
 *
 * NEVER render this component on a public/unauthenticated route.
 *
 * ============================================================
 * GAME LOBBY vs DIRECT GAME LAUNCH
 * ============================================================
 * - No `gameSkinId` → renders BC's full Casino Lobby (game browser).
 * - With `gameSkinId` → deep-links directly into a specific game.
 *   Use this when building a custom game grid and opening a game
 *   in a modal or full-screen iFrame.
 * ============================================================
 */

import { useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CasinoIframeProps {
  /** Player's JWT issued at login. BC forwards this as `Token` in wallet calls. */
  token: string | null;
  /** BC Partner ID from NEXT_PUBLIC_BC_PARTNER_ID. Identifies your platform. */
  partnerId?: string;
  /** IETF language tag (e.g. 'en', 'de', 'ru'). Defaults to 'en'. */
  lang?: string;
  /**
   * Play mode:
   *   'real' — Real-money play (balance read/written via wallet API).
   *   'demo' — Free-play mode (no wallet calls made by BC).
   * Defaults to 'real'.
   */
  mode?: "real" | "demo";
  /**
   * Optional numeric skin/theme ID for direct game launching.
   * Omit to show the full Casino Lobby (game browser).
   */
  gameSkinId?: number | string;
  /** ISO 4217 currency code (e.g. 'USD'). Defaults to user's profile currency. */
  currency?: string;
  /**
   * Tailwind CSS class(es) applied to the iframe wrapper div.
   * Defaults to full-width, viewport-minus-navbar height.
   */
  className?: string;
}

// ── URL builder ───────────────────────────────────────────────────────────────

/**
 * Constructs the BC Casino iFrame src URL per Integration API 3.1.4.
 *
 * Modify this function when BC provides the final query parameter spec.
 * Parameters with falsy values are automatically omitted.
 */
function buildCasinoIframeSrc(
  token: string | null,
  partnerId?: string,
  lang = "en",
  mode: "real" | "demo" = "real",
  gameSkinId?: number | string,
  currency?: string
): string {
  const baseUrl = process.env.NEXT_PUBLIC_BC_CASINO_IFRAME_URL;

  if (!baseUrl) {
    return "about:blank";
  }

  const params = new URLSearchParams();

  // Core auth — always required for real-money mode
  if (token)      params.set("token",      token);
  if (partnerId)  params.set("partnerId",  String(partnerId));

  // Localisation
  if (lang)       params.set("lang",       lang);

  // Play mode — BC uses 'real' or 'demo'
  params.set("mode", mode);

  // Direct game launch (optional — omit for full lobby)
  if (gameSkinId != null && gameSkinId !== "") {
    params.set("game_skin_id", String(gameSkinId));
  }

  // Currency (optional — BC will use the player's profile currency if omitted)
  if (currency)   params.set("currency",   currency);

  return `${baseUrl}?${params.toString()}`;
}

// ── Fallback UI helpers ───────────────────────────────────────────────────────

function FallbackBox({
  className,
  iconColor,
  iconPath,
  title,
  body,
}: {
  className: string;
  iconColor: string;
  iconPath: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className={`${className} flex items-center justify-center bg-slate-900`}>
      <div className="text-center space-y-3 p-8">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: `${iconColor}20` }}
        >
          <svg className="w-6 h-6" style={{ color: iconColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
          </svg>
        </div>
        <p className="font-semibold" style={{ color: iconColor }}>{title}</p>
        <div className="text-slate-400 text-sm">{body}</div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CasinoIframe({
  token,
  partnerId = process.env.NEXT_PUBLIC_BC_PARTNER_ID,
  lang = "en",
  mode = "real",
  gameSkinId,
  currency,
  className = "h-[calc(100vh-48px)] w-full",
}: CasinoIframeProps) {
  // Memoize: rebuild URL only when auth-related props change.
  // This prevents the iFrame from reloading on unrelated parent re-renders
  // (e.g., balance polling updates) — which would interrupt the game.
  const src = useMemo(
    () => buildCasinoIframeSrc(token, partnerId, lang, mode, gameSkinId, currency),
    [token, partnerId, lang, mode, gameSkinId, currency]
  );

  const isMisconfigured = !process.env.NEXT_PUBLIC_BC_CASINO_IFRAME_URL;

  // ── Guard: unauthenticated ─────────────────────────────────────
  // Demo mode doesn't require a token; real-money mode does.
  if (!token && mode === "real") {
    return (
      <FallbackBox
        className={className}
        iconColor="#f59e0b"
        iconPath="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        title="Session Required"
        body="Please log in to access the casino."
      />
    );
  }

  // ── Guard: missing env var ─────────────────────────────────────
  if (isMisconfigured) {
    return (
      <FallbackBox
        className={className}
        iconColor="#ef4444"
        iconPath="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        title="Configuration Error"
        body={
          <>
            <code className="text-red-300">NEXT_PUBLIC_BC_CASINO_IFRAME_URL</code> is not set.
            Add it to your <code className="text-slate-300">.env.local</code> file.
          </>
        }
      />
    );
  }

  return (
    <div className={className}>
      <iframe
        src={src}
        title={gameSkinId ? `BetConstruct Casino — Game ${gameSkinId}` : "BetConstruct Casino Lobby"}
        /**
         * Casino games commonly need:
         *   - fullscreen: for immersive game view
         *   - autoplay: some games have intro animations/audio
         *   - clipboard-read/write: for promo code copy
         *   - payment: for potential future in-frame payment flows
         */
        allow="fullscreen; autoplay; clipboard-read; clipboard-write"
        className="w-full h-full border-none block"
        /**
         * sandbox policy:
         *   allow-scripts        — Casino game JS must run
         *   allow-same-origin    — LocalStorage/session within iFrame
         *   allow-forms          — Login/registration forms inside iFrame
         *   allow-popups         — Some games open bonus round popups
         *   allow-popups-to-escape-sandbox — Popups from the iFrame can leave sandbox
         *   allow-top-navigation-by-user-activation — Only user gesture can navigate parent
         *
         * NOTE: Do NOT add allow-top-navigation (without user activation).
         * That would allow the game to redirect the top-level page arbitrarily.
         */
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      />
    </div>
  );
}
