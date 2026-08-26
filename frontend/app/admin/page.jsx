"use client";

import { Activity, ShieldCheck, UsersRound } from "lucide-react";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import { ROLES } from "@/constants/roles";

export default function AdminPage() {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN]}>
      <DashboardShell eyebrow="Admin access" title="Marketplace control room" description="This route is visible only to admin sessions and mirrors the backend role boundary.">
        <div className="dashboard-grid">
          <article><UsersRound /><span>Users</span><strong>Account moderation</strong><p>Review roles, status, and suspension actions in the admin phase.</p></article>
          <article><Activity /><span>Marketplace</span><strong>Operational stats</strong><p>Track auction, bid, payment, and notification health from backend statistics.</p></article>
          <article><ShieldCheck /><span>Audit</span><strong>Traceable actions</strong><p>Admin audit events remain server-side records rather than frontend claims.</p></article>
        </div>
      </DashboardShell>
    </RoleGuard>
  );
}

