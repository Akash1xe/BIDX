"use client";

import Link from "next/link";
import { Gavel, LogOut, Menu, Search, Store, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import useAuth from "@/hooks/useAuth";
import NotificationBell from "@/components/notification/NotificationBell";

export default function PublicHeader() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await logout();
    router.push("/");
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark"><Gavel size={17} /></span>
          <span>Bid<span>X</span></span>
        </Link>
        <nav className={open ? "nav-open" : ""}>
          <Link href="/auctions" onClick={() => setOpen(false)}>Auctions</Link>
          <Link href="/search" onClick={() => setOpen(false)}><Search size={14} /> Search</Link>
          {user?.role === "SELLER" || user?.role === "ADMIN" ? <Link href="/seller" onClick={() => setOpen(false)}><Store size={14} /> Sell</Link> : null}
        </nav>
        <div className="header-actions">
          {isAuthenticated ? (
            <div className="session-actions">
              <NotificationBell />
              <button className="profile-pill" onClick={() => router.push("/dashboard")}>
                <span>{user.name.slice(0, 1).toUpperCase()}</span>{user.name}
              </button>
              <button className="icon-button" aria-label="Sign out" onClick={signOut}><LogOut size={16} /></button>
            </div>
          ) : (
            <>
              <Button variant="ghost" onClick={() => router.push("/login")}>Sign in</Button>
              <Button className="primary-button" onClick={() => router.push("/signup")}>Start bidding</Button>
            </>
          )}
          <button className="mobile-menu" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
