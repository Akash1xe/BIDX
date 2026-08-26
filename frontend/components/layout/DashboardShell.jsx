"use client";

import Link from "next/link";
import { Bell, CreditCard, Gavel, LogOut, ShieldCheck, Store, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import useAuth from "@/hooks/useAuth";

const roleLinks = {
  USER: [
    { href: "/dashboard", label: "My dashboard", icon: UserRound },
    { href: "/dashboard/bids", label: "My bids", icon: Gavel },
    { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
  ],
  SELLER: [
    { href: "/dashboard", label: "Buyer view", icon: UserRound },
    { href: "/dashboard/bids", label: "My bids", icon: Gavel },
    { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
    { href: "/seller", label: "Seller studio", icon: Store },
    { href: "/seller/products", label: "Products", icon: Store },
    { href: "/seller/auctions", label: "Auctions", icon: Gavel },
  ],
  ADMIN: [
    { href: "/dashboard", label: "Buyer view", icon: UserRound },
    { href: "/dashboard/bids", label: "My bids", icon: Gavel },
    { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
    { href: "/seller", label: "Seller studio", icon: Store },
    { href: "/seller/products", label: "Products", icon: Store },
    { href: "/seller/auctions", label: "Auctions", icon: Gavel },
    { href: "/admin", label: "Admin", icon: ShieldCheck },
  ],
};

export default function DashboardShell({ eyebrow, title, description, children }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function signOut() {
    await logout();
    router.replace("/");
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link href="/" className="auth-brand"><span><Gavel size={18} /></span>Bid<span>X</span></Link>
        <nav aria-label="Account navigation">
          {(roleLinks[user.role] || roleLinks.USER).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}><Icon size={15} /> {label}</Link>
          ))}
        </nav>
        <div className="dashboard-account">
          <button className="icon-button" aria-label="Notifications"><Bell size={17} /></button>
          <span className="dashboard-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.name}</strong><small>{user.email}</small></div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut /></Button>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="dashboard-title">
          <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
          <Badge variant="outline">{user.role}</Badge>
        </div>
        {children}
      </section>
    </main>
  );
}
