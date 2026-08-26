"use client";

import AdminAuctions from "@/components/admin/AdminAuctions";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import { ROLES } from "@/constants/roles";

export default function AdminAuctionsPage() {
  return <RoleGuard allowedRoles={[ROLES.ADMIN]}><DashboardShell eyebrow="Admin · Auctions" title="Marketplace inspection" description="Filter and inspect auction records without bypassing Auction Service ownership rules."><AdminAuctions /></DashboardShell></RoleGuard>;
}
