"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import ProductForm from "@/components/seller/ProductForm";
import { ROLES } from "@/constants/roles";

export default function CreateProductPage() {
  return <RoleGuard allowedRoles={[ROLES.SELLER, ROLES.ADMIN]}><DashboardShell eyebrow="Seller inventory" title="Create product" description="Create the immutable product identity before scheduling its auction."><ProductForm /></DashboardShell></RoleGuard>;
}
