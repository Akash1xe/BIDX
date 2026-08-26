"use client";

import Link from "next/link";
import { AlertTriangle, PackagePlus } from "lucide-react";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/constants/roles";

export default function SellerProductsPage() {
  return <RoleGuard allowedRoles={[ROLES.SELLER, ROLES.ADMIN]}><DashboardShell eyebrow="Seller inventory" title="Products" description="Create the product records used by BidX auctions."><div className="contract-gap-panel"><AlertTriangle /><div><p className="eyebrow">Backend contract gap</p><h2>Product listing is not available yet</h2><p>The current backend exposes product create, get-by-ID, and delete, but no authenticated seller product-list endpoint. This page does not invent inventory. Create a product and BidX will carry its returned ID directly into auction creation.</p><Button asChild className="primary-button"><Link href="/seller/products/create"><PackagePlus /> Create product</Link></Button></div></div></DashboardShell></RoleGuard>;
}
