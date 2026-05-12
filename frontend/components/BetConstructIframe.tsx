"use client";

/**
 * @component BetConstructIframe
 * @description Embeds the BetConstruct Sportsbook iFrame.
 *
 * ============================================================
 * HOW THE URL IS BUILT (Partner API v0.40)
 * ============================================================
 * The base URL is defined in the environment:
 *   NEXT_PUBLIC_BC_IFRAME_URL=https://your-bc-partner-url.com/sports
 *
 * We append query parameters that BC uses to:
 *   1. Authenticate the user  → ?token=<JWT>
 *   2. Set the display language → &lang=en
 *   3. (Optional) Set the partner skin → &partnerId=<id>
 *
 * The exact parameter names depend on your BC back-office configuration.
 * Change `buildIframeSrc` below when BC provides the final URL spec.
 *
 * ============================================================
 * SECURITY NOTE
 * ============================================================
 * The token passed here is the same JWT your backend issued at login.
 * BC's backend will forward it to our /api/bc/GetClientDetails endpoint
 * as `AuthToken`, which we decode using JWT_SECRET to identify the user.
 *
 * NEVER pass a token if the component is rendered on a public route.
 * ============================================================
 */

import { useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BetConstructIframeProps {
  /** The user's JWT issued at login. Used by BC as AuthToken. */
  token: string | null;
  /** Optional BCP partner identifier (from NEXT_PUBLIC_BC_PARTNER_ID). */
  partnerId?: string;
  /** BCP display language code, e.g. 'en', 'de'. Defaults to 'en'. */
  lang?: string;
  /**
   * Tailwind CSS class(es) for the iframe wrapper div.
   * Defaults to full-width, viewport-minus-navbar height.
   */
  className?: string;
}

// ── URL builder ───────────────────────────────────────────────────────────────

/**
 * Constructs the BC iFrame src URL.
 *
 * Change this function when BC provides the final query parameter spec.
 * All params are optional/gracefully omitted if not set.
 */
function buildIframeSrc(token: string | null, partnerId?: string, lang = "en"): string {
  const baseUrl = process.env.NEXT_PUBLIC_BC_IFRAME_URL;

  if (!baseUrl) {
    // Return a blank page so the iframe renders safely without a base URL.
    // The error boundary text below will also be shown via the overlay.
    return "about:blank";
  }

  const params = new URLSearchParams();

  if (token)     params.set("token",     token);
  if (lang)      params.set("lang",      lang);
  if (partnerId) params.set("partnerId", partnerId);

  return `${baseUrl}?${params.toString()}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BetConstructIframe({
  token,
  partnerId = process.env.NEXT_PUBLIC_BC_PARTNER_ID,
  lang = "en",
  className = "h-[calc(100vh-48px)] w-full",
}: BetConstructIframeProps) {
  // Memoize so the URL only rebuilds when auth state actually changes,
  // preventing unnecessary iframe reloads on parent re-renders.
  const src = useMemo(
    () => buildIframeSrc(token, partnerId, lang),
    [token, partnerId, lang]
  );

  const isMisconfigured = !process.env.NEXT_PUBLIC_BC_IFRAME_URL;

  if (!token) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-900`}>
        <div className="text-center space-y-3 p-8">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-amber-400 font-semibold">Session Required</p>
          <p className="text-slate-400 text-sm">Please log in to access the sportsbook.</p>
        </div>
      </div>
    );
  }

  if (isMisconfigured) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-900`}>
        <div className="text-center space-y-3 p-8">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-400 font-semibold">Configuration Error</p>
          <p className="text-slate-400 text-sm max-w-xs">
            <code className="text-red-300">NEXT_PUBLIC_BC_IFRAME_URL</code> is not set.
            Add it to your <code className="text-slate-300">.env.local</code> file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <iframe
        src={src}
        title="BetConstruct Sportsbook"
        /**
         * allow="*" grants the iFrame access to browser APIs BC may need
         * (e.g., clipboard for share links, fullscreen for video streams).
         * Tighten to a specific allowlist once you know BC's requirements.
         */
        allow="fullscreen; clipboard-read; clipboard-write"
        /**
         * scrolling inside the iFrame is handled by BC's own UI.
         * We clip overflow at the container level instead.
         */
        className="w-full h-full border-none block"
        // Prevent BC's iFrame content from navigating the top-level page.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      />
    </div>
  );
}
