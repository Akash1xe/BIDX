"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import AdminOverview from "@/components/admin/AdminOverview";
import DashboardShell from "@/components/layout/DashboardShell";
import { ROLES } from "@/constants/roles";

export default function AdminPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN]}>
      <DashboardShell eyebrow="Admin access" title="Marketplace control room" description="Live operational totals from the BidX Admin Service, restricted to verified admin sessions."><AdminOverview /></DashboardShell>
    </RoleGuard>
  );
}
