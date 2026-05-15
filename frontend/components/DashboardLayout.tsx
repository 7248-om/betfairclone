"use client";

/**
 * @component DashboardLayout — Dark Teal theme
 *
 * Handles logout centrally so every page gets a working Navbar logout button
 * without having to wire onLogout individually.
 */

import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { useAuthStore } from "@/store/useAuthStore";

type AccountType = "MAIN" | "MASTER" | "CLIENT";

interface DashboardLayoutProps {
  children: React.ReactNode;
  accountType: AccountType;
  username: string;
  balance: number;
  exposure?: number;
}

export default function DashboardLayout({
  children,
  accountType,
  username,
  balance,
  exposure,
}: DashboardLayoutProps) {
  const router = useRouter();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <Navbar
        accountType={accountType}
        username={username}
        balance={balance}
        exposure={exposure}
        onLogout={handleLogout}
      />
      <Sidebar accountType={accountType} />

      {/* Main content: offset for navbar (h-12) and sidebar (w-48) */}
      <main className="pt-12 pl-48 min-h-screen">
        <div className="p-4 md:p-6 max-w-screen-2xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
