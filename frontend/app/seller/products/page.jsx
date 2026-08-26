import Link from "next/link";
import { PackagePlus } from "lucide-react";
import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import SellerProductList from "@/components/seller/SellerProductList";
import { ROLES } from "@/constants/roles";

export default function SellerProductsPage() {
  return <RoleGuard allowedRoles={[ROLES.SELLER, ROLES.ADMIN]}><DashboardShell eyebrow="Seller inventory" title="Products" description="Manage the authenticated seller's real product records."><div className="seller-list-toolbar"><p>Only your products are returned by the backend.</p><Button asChild className="primary-button"><Link href="/seller/products/create"><PackagePlus /> Create product</Link></Button></div><SellerProductList /></DashboardShell></RoleGuard>;
}
