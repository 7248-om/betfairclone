/**
 * @component DashboardLayout — Dark Teal theme
 */

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

type AccountType = "MAIN" | "MASTER" | "CLIENT";

interface DashboardLayoutProps {
  children: React.ReactNode;
  accountType: AccountType;
  username: string;
  balance: number;
  exposure?: number;
  onLogout?: () => void;
}

export default function DashboardLayout({
  children,
  accountType,
  username,
  balance,
  exposure,
  onLogout,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <Navbar accountType={accountType} username={username} balance={balance} exposure={exposure} onLogout={onLogout} />
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
