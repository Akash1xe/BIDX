"use client";

import AdminOverview from "@/components/admin/AdminOverview";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import { ROLES } from "@/constants/roles";

export default function AdminStatsPage() {
  return <RoleGuard allowedRoles={[ROLES.ADMIN]}><DashboardShell eyebrow="Admin · Statistics" title="Marketplace statistics" description="Current aggregate users, auctions, bids, payments, and GMV from backend collections."><AdminOverview /></DashboardShell></RoleGuard>;
}
