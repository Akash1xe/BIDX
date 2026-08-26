"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import AuctionForm from "@/components/seller/AuctionForm";
import DashboardShell from "@/components/layout/DashboardShell";
import { ROLES } from "@/constants/roles";

export default function CreateAuctionPage() {
  return <RoleGuard allowedRoles={[ROLES.SELLER, ROLES.ADMIN]}><DashboardShell eyebrow="Seller control room" title="Create auction" description="Attach an owned product, set pricing and timing, then create a backend-controlled draft."><AuctionForm /></DashboardShell></RoleGuard>;
}
