"use client";

import Link from "next/link";
import { History, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuctionBids } from "@/features/bidding/hooks";
import useAuth from "@/hooks/useAuth";
import { formatMoney } from "@/utils/auction";

function bidderLabel(bidderId, userId) {
  if (String(bidderId) === String(userId)) return "You";
  return `Bidder •••${String(bidderId || "").slice(-4)}`;
}

export default function BidHistory({ auctionId }) {
  const { user, isAuthenticated } = useAuth();
  const query = useAuctionBids(auctionId);

  if (!isAuthenticated) {
    return <div className="history-locked"><History /><div><strong>Bid history is protected</strong><p>Sign in to view authenticated auction bid records.</p></div><Button asChild variant="outline"><Link href={`/login?next=${encodeURIComponent(`/auctions/${auctionId}`)}`}>Sign in</Link></Button></div>;
  }

  return (
    <section className="bid-history-section">
      <div className="bid-history-heading"><div><p className="eyebrow">Authenticated records</p><h2>Bid history</h2></div><span>{query.data?.pagination?.total || 0} bids</span></div>
      {query.isLoading && <div className="history-loading"><LoaderCircle className="spin" /> Loading bid history…</div>}
      {query.isError && <div className="history-error"><strong>Bid history unavailable</strong><p>{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>}
      {query.isSuccess && !(query.data?.items || []).length && <div className="history-empty">No bids yet. The first accepted bid will appear here.</div>}
      {query.isSuccess && (query.data?.items || []).length > 0 && <div className="table-shell"><Table><TableHeader><TableRow><TableHead>Bidder</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Time</TableHead></TableRow></TableHeader><TableBody>{query.data.items.map((bid) => <TableRow key={bid.id}><TableCell>{bidderLabel(bid.bidderId, user.id)}</TableCell><TableCell className="history-amount">{formatMoney(bid.amount)}</TableCell><TableCell>{bid.status}</TableCell><TableCell>{new Date(bid.createdAt).toLocaleString("en-IN")}</TableCell></TableRow>)}</TableBody></Table></div>}
    </section>
  );
}

