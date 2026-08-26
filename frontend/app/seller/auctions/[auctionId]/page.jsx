"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import AuctionManager from "@/components/seller/AuctionManager";
import DashboardShell from "@/components/layout/DashboardShell";
import { ROLES } from "@/constants/roles";

export default function ManageAuctionPage() {
  return <RoleGuard allowedRoles={[ROLES.SELLER, ROLES.ADMIN]}><DashboardShell eyebrow="Auction management" title="Control auction" description="Edit eligible settings or perform backend-authorized lifecycle actions."><AuctionManager /></DashboardShell></RoleGuard>;
}
