"use client";

import Link from "next/link";
import { Activity, ArrowRight, BadgeIndianRupee, CircleDollarSign, Gavel, ShieldAlert, ShieldCheck, Store, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/feedback/QueryState";
import { useAdminStats } from "@/features/admin/hooks";

const count = new Intl.NumberFormat("en-IN");
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function AdminOverview() {
  const query = useAdminStats();

  if (query.isLoading) return <div className="admin-stat-grid">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="admin-stat-skeleton" />)}</div>;
  if (query.isError) return <QueryError title="Admin statistics are unavailable" error={query.error} onRetry={() => query.refetch()} />;

  const stats = query.data || {};
  const metrics = [
    ["Registered users", stats.users, UsersRound],
    ["Seller accounts", stats.sellers, Store],
    ["Suspended users", stats.suspendedUsers, ShieldAlert],
    ["Total auctions", stats.auctions, Gavel],
    ["Live auctions", stats.liveAuctions, Activity],
    ["Sold auctions", stats.soldAuctions, ShieldCheck],
    ["Accepted bids", stats.bids, CircleDollarSign],
    ["Paid orders", stats.paidPayments, BadgeIndianRupee],
  ];
  const soldRate = stats.auctions ? Math.round((stats.soldAuctions / stats.auctions) * 100) : 0;
  const sellerRate = stats.users ? Math.round((stats.sellers / stats.users) * 100) : 0;

  return (
    <div className="admin-overview">
      <section className="admin-stat-grid">
        {metrics.map(([label, value, Icon]) => <article key={label} className="admin-stat-card"><Icon /><span>{label}</span><strong>{count.format(value || 0)}</strong></article>)}
      </section>

      <section className="admin-insight-grid">
        <article className="admin-gmv-card"><div><p className="eyebrow">Verified marketplace volume</p><h2>{money.format((stats.gmvMinor || 0) / 100)}</h2><p>Gross value from Payment Service records whose backend status is PAID.</p></div><BadgeIndianRupee /></article>
        <article className="admin-health-card"><p className="eyebrow">Marketplace ratios</p><div><span>Auctions sold <strong>{soldRate}%</strong></span><Progress value={soldRate} /></div><div><span>Users with seller role <strong>{sellerRate}%</strong></span><Progress value={sellerRate} /></div></article>
      </section>

      <section className="admin-action-grid">
        <article><UsersRound /><div><strong>User moderation</strong><p>Search accounts and perform audited suspension actions.</p></div><Button asChild variant="outline"><Link href="/admin/users">Open users <ArrowRight /></Link></Button></article>
        <article><Gavel /><div><strong>Auction inspection</strong><p>Filter and inspect the backend auction collection.</p></div><Button asChild variant="outline"><Link href="/admin/auctions">Open auctions <ArrowRight /></Link></Button></article>
        <article><ShieldCheck /><div><strong>Audit trail</strong><p>Review every recorded admin moderation action.</p></div><Button asChild variant="outline"><Link href="/admin/audit">Open audit <ArrowRight /></Link></Button></article>
      </section>
    </div>
  );
}
