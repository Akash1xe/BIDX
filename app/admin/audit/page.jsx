"use client";

import AdminAudit from "@/components/admin/AdminAudit";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import { ROLES } from "@/constants/roles";

export default function AdminAuditPage() {
  return <RoleGuard allowedRoles={[ROLES.ADMIN]}><DashboardShell eyebrow="Admin · Audit" title="Moderation audit trail" description="Chronological records written by the Admin Service after successful actions."><AdminAudit /></DashboardShell></RoleGuard>;
}
