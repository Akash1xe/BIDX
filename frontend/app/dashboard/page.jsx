"use client";

import Link from "next/link";
import { ArrowRight, Gavel, UserRound, WalletCards } from "lucide-react";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import SellerOnboardingCard from "@/components/seller/SellerOnboardingCard";

export default function DashboardPage() {
  return (
    <RoleGuard>
      <DashboardShell eyebrow="Buyer workspace" title="Your auction activity" description="The protected home for your bids, payments, and profile.">
        <div className="dashboard-grid">
          <article><Gavel /><span>My bids</span><strong>Live bidding is ready</strong><p>Review every backend-confirmed bid and return to its auction.</p><Link className="dashboard-card-link" href="/dashboard/bids">Open my bids <ArrowRight /></Link></article>
          <article><WalletCards /><span>Payments</span><strong>Verified checkout</strong><p>Review winning orders and backend-confirmed payment status.</p><Link className="dashboard-card-link" href="/dashboard/payments">Open payments <ArrowRight /></Link></article>
          <article><UserRound /><span>Profile</span><strong>Authenticated</strong><p>Your identity is loaded from the shared BidX session and remains backend-authoritative.</p></article>
        </div>
        <SellerOnboardingCard />
      </DashboardShell>
    </RoleGuard>
  );
}
