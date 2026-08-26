"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import SellerAuctionList from "@/components/seller/SellerAuctionList";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/constants/roles";

export default function SellerAuctionsPage() {
  return <RoleGuard allowedRoles={[ROLES.SELLER, ROLES.ADMIN]}><DashboardShell eyebrow="Seller control room" title="Auctions" description="Manage only the auctions owned by the authenticated seller."><div className="seller-list-toolbar"><p>Status transitions and ownership are always rechecked by the backend.</p><Button asChild className="primary-button"><Link href="/seller/auctions/create"><Plus /> Create auction</Link></Button></div><SellerAuctionList /></DashboardShell></RoleGuard>;
}
