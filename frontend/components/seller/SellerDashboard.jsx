"use client";

import Link from "next/link";
import { ArrowRight, Boxes, CalendarClock, CircleDollarSign, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuctions } from "@/features/auctions/hooks";
import useAuth from "@/hooks/useAuth";
import { formatMoney } from "@/utils/auction";

export default function SellerDashboard() {
  const { user } = useAuth();
  const query = useAuctions({ sellerId: user.id, page: 1, limit: 50 });
  const auctions = query.data?.items || [];
  const active = auctions.filter((item) => ["LIVE", "SCHEDULED"].includes(item.status)).length;
  const completed = auctions.filter((item) => ["ENDED", "SOLD", "UNSOLD", "PAYMENT_PENDING"].includes(item.status)).length;
  const soldValue = auctions.filter((item) => item.status === "SOLD").reduce((sum, item) => sum + Number(item.finalPrice || 0), 0);

  return (
    <>
      <div className="seller-action-row"><Button asChild className="primary-button"><Link href="/seller/products/create"><Boxes /> Create product</Link></Button><Button asChild variant="outline"><Link href="/seller/auctions/create"><CalendarClock /> Create auction</Link></Button></div>
      <div className="seller-stats">
        <article><Boxes /><span>Products</span><strong>—</strong><p>The backend still needs a seller product-list endpoint.</p></article>
        <article><Gavel /><span>Active auctions</span><strong>{query.isLoading ? <Skeleton className="seller-stat-skeleton" /> : active}</strong><p>Live and scheduled inventory.</p></article>
        <article><CalendarClock /><span>Completed</span><strong>{query.isLoading ? <Skeleton className="seller-stat-skeleton" /> : completed}</strong><p>Ended, sold, unsold, or awaiting payment.</p></article>
        <article><CircleDollarSign /><span>Sold value</span><strong>{query.isLoading ? <Skeleton className="seller-stat-skeleton" /> : formatMoney(soldValue)}</strong><p>Final prices for SOLD auctions; payment revenue arrives in Phase 6.</p></article>
      </div>
      {query.isError && <p className="seller-form-error">{query.error.message}</p>}
      <div className="seller-paths"><Link href="/seller/products"><div><Boxes /><span>Inventory</span><h2>Products</h2><p>Create auction-ready products and carry their backend IDs into scheduling.</p></div><ArrowRight /></Link><Link href="/seller/auctions"><div><Gavel /><span>Control room</span><h2>Auctions</h2><p>Edit drafts, start live bidding, close auctions, and inspect outcomes.</p></div><ArrowRight /></Link></div>
    </>
  );
}
