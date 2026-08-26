"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import SellerDashboard from "@/components/seller/SellerDashboard";
import { ROLES } from "@/constants/roles";

export default function SellerPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.SELLER, ROLES.ADMIN]}>
      <DashboardShell eyebrow="Seller access" title="Seller studio" description="Only seller and admin sessions can enter this frontend route; the API still verifies every write.">
        <SellerDashboard />
      </DashboardShell>
    </RoleGuard>
  );
}
