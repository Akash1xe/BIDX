"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import MyBids from "@/components/bidding/MyBids";
import DashboardShell from "@/components/layout/DashboardShell";

export default function MyBidsPage() {
  return (
    <RoleGuard>
      <DashboardShell eyebrow="Buyer workspace" title="My bids" description="Backend-confirmed bids from every auction you have joined.">
        <MyBids />
      </DashboardShell>
    </RoleGuard>
  );
}
