"use client";

/**
 * @component Navbar — Dark Teal theme (R777 style)
 */

import Link from "next/link";

type AccountType = "MAIN" | "MASTER" | "CLIENT";

interface NavbarProps {
  accountType: AccountType;
  username: string;
  balance: number;
  exposure?: number;
  onLogout?: () => void;
}

const badgeStyles: Record<AccountType, string> = {
  MAIN:   "font-bold text-xs px-2 py-0.5 rounded-sm",
  MASTER: "font-bold text-xs px-2 py-0.5 rounded-sm",
  CLIENT: "font-bold text-xs px-2 py-0.5 rounded-sm",
};

const badgeInlineStyles: Record<AccountType, React.CSSProperties> = {
  MAIN:   { backgroundColor: "var(--warning)",  color: "#000" },
  MASTER: { backgroundColor: "#a855f7",          color: "#fff" },
  CLIENT: { backgroundColor: "var(--teal)",      color: "#fff" },
};

const badgeLabels: Record<AccountType, string> = {
  MAIN:   "Admin",
  MASTER: "Master",
  CLIENT: "Client",
};

export default function Navbar({ accountType, username, balance, exposure = 0, onLogout }: NavbarProps) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 h-12 flex items-center justify-between px-4 shadow-lg text-white"
      style={{ backgroundColor: "var(--teal-dark)", borderBottom: "1px solid var(--border)", background: "linear-gradient(to bottom, var(--teal-light), var(--teal-dark))" }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-teal-dark bg-white"
        >
          R777
        </div>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Username + badge */}
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-white hidden sm:block">{username}</span>
          <span className={badgeStyles[accountType]} style={badgeInlineStyles[accountType]}>
            {badgeLabels[accountType]}
          </span>
        </div>

        {/* Exposure */}
        <div
          className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded text-xs bg-black/20 border border-white/10"
        >
          <span className="text-white/80">EXP:</span>
          <span className="font-bold text-white tabular-nums">{exposure.toFixed(2)}</span>
        </div>

        {/* Balance */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold cursor-default"
          style={{ backgroundColor: "var(--warning)", color: "#000" }}
        >
          <svg className="w-3 h-3 opacity-80" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
          </svg>
          <span className="tabular-nums">{balance.toLocaleString()}</span>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded transition-colors"
          style={{ color: "rgba(255,255,255,0.8)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:block font-bold">Logout</span>
        </button>
      </div>
    </header>
  );
}
