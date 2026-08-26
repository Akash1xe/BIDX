"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { roleHome } from "@/features/auth/navigation";
import useAuth from "@/hooks/useAuth";

export default function RoleGuard({ allowedRoles, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();
  const isAllowed = !allowedRoles?.length || allowedRoles.includes(user?.role);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
      return;
    }

    if (!isAllowed) router.replace(roleHome(user.role));
  }, [isAllowed, isAuthenticated, isLoading, pathname, router, user?.role]);

  if (isLoading || !isAuthenticated) {
    return <div className="route-state"><LoaderCircle className="spin" /><strong>Checking your BidX session…</strong></div>;
  }

  if (!isAllowed) {
    return <div className="route-state"><LockKeyhole /><strong>Redirecting to your workspace…</strong></div>;
  }

  return children;
}

