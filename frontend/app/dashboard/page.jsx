"use client";

import { Gavel, UserRound, WalletCards } from "lucide-react";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";

export default function DashboardPage() {
  return (
    <RoleGuard>
      <DashboardShell eyebrow="Buyer workspace" title="Your auction activity" description="The protected home for your bids, payments, and profile.">
        <div className="dashboard-grid">
          <article><Gavel /><span>My bids</span><strong>Ready for Phase 4</strong><p>Live bid status and bid history will use the authenticated bidding endpoints.</p></article>
          <article><WalletCards /><span>Payments</span><strong>Ready for Phase 6</strong><p>Winning orders and payment history will appear only for the signed-in user.</p></article>
          <article><UserRound /><span>Profile</span><strong>Authenticated</strong><p>Your identity is loaded from the shared BidX session and remains backend-authoritative.</p></article>
        </div>
      </DashboardShell>
    </RoleGuard>
  );
}

