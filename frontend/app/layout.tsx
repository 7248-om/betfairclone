import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StakeClone — Private Sportsbook",
  description: "Invite-only virtual sportsbook platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full" style={{ backgroundColor: "var(--bg-primary)" }}>
        {children}
      </body>
    </html>
  );
}
