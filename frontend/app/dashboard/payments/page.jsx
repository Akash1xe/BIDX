"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import PaymentHistory from "@/components/payment/PaymentHistory";

export default function PaymentsPage() {
  return <RoleGuard><DashboardShell eyebrow="Buyer workspace" title="Payment history" description="Orders where you are the winner or seller, directly from the Payment Service."><PaymentHistory /></DashboardShell></RoleGuard>;
}
