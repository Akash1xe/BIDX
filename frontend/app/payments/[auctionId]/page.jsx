"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import PaymentCheckout from "@/components/payment/PaymentCheckout";

export default function AuctionPaymentPage() {
  return <RoleGuard><DashboardShell eyebrow="Secure checkout" title="Auction payment" description="Winner eligibility, order state, and payment confirmation are verified by the BidX backend."><PaymentCheckout /></DashboardShell></RoleGuard>;
}
