"use client";

import { Boxes, CalendarClock, IndianRupee } from "lucide-react";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import { ROLES } from "@/constants/roles";

export default function SellerPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.SELLER, ROLES.ADMIN]}>
      <DashboardShell eyebrow="Seller access" title="Seller studio" description="Only seller and admin sessions can enter this frontend route; the API still verifies every write.">
        <div className="dashboard-grid">
          <article><Boxes /><span>Products</span><strong>Product catalog</strong><p>Create and manage auction-ready inventory in the seller implementation phase.</p></article>
          <article><CalendarClock /><span>Auctions</span><strong>Schedule and control</strong><p>Create, start, edit, end, and inspect your auctions.</p></article>
          <article><IndianRupee /><span>Revenue</span><strong>Seller results</strong><p>Completed sales and verified payment records will power this summary.</p></article>
        </div>
      </DashboardShell>
    </RoleGuard>
  );
}

