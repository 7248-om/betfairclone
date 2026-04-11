"use client";

/**
 * @component Sidebar — Dark Teal theme (R777 style)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

type AccountType = "MAIN" | "MASTER" | "CLIENT";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: Record<AccountType, NavItem[]> = {
  MAIN: [
    { label: "Overview",     href: "/admin/dashboard", icon: "🏠" },
    { label: "Masters",      href: "/admin/masters",   icon: "👥" },
    { label: "Treasury",     href: "/admin/treasury",  icon: "💰" },
    { label: "Activity Log", href: "/admin/activity",  icon: "📋" },
    { label: "Settings",     href: "/admin/settings",  icon: "⚙️" },
  ],
  MASTER: [
    { label: "Dashboard",       href: "/master/dashboard", icon: "🏠" },
    { label: "My Clients",      href: "/master/clients",   icon: "👥" },
    { label: "Bet History",     href: "/master/bets",      icon: "📋" },
    { label: "Transfer Coins",  href: "/master/transfer",  icon: "💸" },
    { label: "P&L Report",      href: "/master/pnl",       icon: "📊" },
  ],
  CLIENT: [
    { label: "In-Play",     href: "/client/dashboard", icon: "🔴", badge: 12 },
    { label: "Cricket",     href: "/client/cricket",   icon: "🏏" },
    { label: "Soccer",      href: "/client/soccer",    icon: "⚽" },
    { label: "Tennis",      href: "/client/tennis",    icon: "🎾" },
    { label: "Horse",       href: "/client/horse",     icon: "🐎" },
    { label: "My Bets",     href: "/client/bets",      icon: "📋" },
    { label: "Account",     href: "/client/account",   icon: "👤" },
  ],
};

interface SidebarProps {
  accountType: AccountType;
}

export default function Sidebar({ accountType }: SidebarProps) {
  const pathname = usePathname();
  const items = navItems[accountType];

  return (
    <aside
      className="fixed top-12 left-0 bottom-0 w-48 flex flex-col z-30 overflow-y-auto"
      style={{ backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border)" }}
    >
      {/* Section label */}
      <div className="px-3 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        {accountType === "CLIENT" ? "Sports" : accountType === "MASTER" ? "Agent" : "Platform"}
      </div>

      <nav className="flex-1 px-1 pb-4">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between px-3 py-2.5 rounded text-sm font-medium transition-all mb-0.5 group"
              style={{
                backgroundColor: isActive ? "var(--teal-muted)" : "transparent",
                color: isActive ? "var(--teal-dark)" : "var(--text-secondary)",
                borderLeft: isActive ? "3px solid var(--teal)" : "3px solid transparent",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: "var(--danger)" }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
        <p className="font-medium">StakeClone v1.0</p>
        <p>Private beta</p>
      </div>
    </aside>
  );
}
