import { redirect } from "next/navigation";

export default function ClientBetsPage() {
  // "My Bets" simply aliases to the Unsettled Bets tab in the Account Portal
  redirect("/client/account?tab=unsettled");
}
