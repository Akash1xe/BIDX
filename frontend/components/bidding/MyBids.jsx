"use client";

import Link from "next/link";
import { ArrowUpRight, Gavel, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMyBids } from "@/features/bidding/hooks";
import { formatMoney } from "@/utils/auction";

export default function MyBids() {
  const query = useMyBids(1);

  if (query.isLoading) return <div className="history-loading"><LoaderCircle className="spin" /> Loading your bids…</div>;
  if (query.isError) return <div className="history-error"><strong>Your bids are unavailable</strong><p>{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>;
  const bids = query.data?.items || [];
  if (!bids.length) return <div className="my-bids-empty"><Gavel /><h2>No bids yet</h2><p>Open a live auction and place your first bid.</p><Button asChild className="primary-button"><Link href="/auctions">Browse auctions</Link></Button></div>;

  return <div className="table-shell my-bids-table"><Table><TableHeader><TableRow><TableHead>Auction</TableHead><TableHead>Your bid</TableHead><TableHead>Backend status</TableHead><TableHead>Placed</TableHead><TableHead /></TableRow></TableHeader><TableBody>{bids.map((bid) => <TableRow key={bid.id}><TableCell className="font-medium">{`Auction •••${bid.auctionId.slice(-6)}`}</TableCell><TableCell className="history-amount">{formatMoney(bid.amount)}</TableCell><TableCell><Badge variant="outline">{bid.status}</Badge></TableCell><TableCell>{new Date(bid.createdAt).toLocaleString("en-IN")}</TableCell><TableCell><Button asChild variant="ghost" size="icon-sm"><Link href={`/auctions/${bid.auctionId}`} aria-label="Open auction"><ArrowUpRight /></Link></Button></TableCell></TableRow>)}</TableBody></Table></div>;
}

