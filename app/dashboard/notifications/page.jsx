"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import NotificationCenter from "@/components/notification/NotificationCenter";

export default function NotificationsPage() {
  return <RoleGuard><DashboardShell eyebrow="Account activity" title="Notifications" description="Auction and payment delivery records produced by the BidX event pipeline."><NotificationCenter /></DashboardShell></RoleGuard>;
}
