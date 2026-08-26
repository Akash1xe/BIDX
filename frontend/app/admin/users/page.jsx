"use client";

import AdminUsers from "@/components/admin/AdminUsers";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import { ROLES } from "@/constants/roles";

export default function AdminUsersPage() {
  return <RoleGuard allowedRoles={[ROLES.ADMIN]}><DashboardShell eyebrow="Admin · Users" title="Account moderation" description="Search user records and perform backend-authorized, audited suspension actions."><AdminUsers /></DashboardShell></RoleGuard>;
}
