"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, LoaderCircle, Play, Plus, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuctions, useDeleteAuction, useEndAuction, useStartAuction } from "@/features/auctions/hooks";
import useAuth from "@/hooks/useAuth";
import { formatMoney, getPagination, getProduct } from "@/utils/auction";

function AuctionActions({ auction }) {
  const start = useStartAuction(auction.id);
  const end = useEndAuction(auction.id);
  const remove = useDeleteAuction(auction.id);
  const busy = start.isPending || end.isPending || remove.isPending;

  async function run(mutation, success) {
    try { await mutation.mutateAsync(); toast.success(success); }
    catch (error) { toast.error(error.message); }
  }

  return <div className="seller-table-actions"><Button asChild variant="ghost" size="icon-sm"><Link href={`/seller/auctions/${auction.id}`} aria-label="Manage auction"><ArrowUpRight /></Link></Button>{["DRAFT", "SCHEDULED"].includes(auction.status) && <Button variant="outline" size="sm" disabled={busy} onClick={() => run(start, "Auction is now live.")}><Play /> Start</Button>}{auction.status === "LIVE" && <Button variant="outline" size="sm" disabled={busy} onClick={() => run(end, "Auction ended.")}><Square /> End</Button>}{auction.status === "DRAFT" && <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon-sm" disabled={busy} aria-label="Delete draft"><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this draft?</AlertDialogTitle><AlertDialogDescription>This permanently removes the auction. The backend only permits deletion while it is DRAFT.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => run(remove, "Draft deleted.")}>Delete draft</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>;
}

export default function SellerAuctionList() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const query = useAuctions({ sellerId: user.id, page, limit: 20 });
  const pagination = getPagination(query.data, page);

  if (query.isLoading) return <div className="history-loading"><LoaderCircle className="spin" /> Loading seller auctions…</div>;
  if (query.isError) return <div className="history-error"><strong>Seller auctions unavailable</strong><p>{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>;
  const auctions = query.data?.items || [];
  if (!auctions.length) return <div className="my-bids-empty"><Plus /><h2>No seller auctions yet</h2><p>Create a product first, then schedule its auction.</p><Button asChild className="primary-button"><Link href="/seller/products/create">Create product</Link></Button></div>;

  return <><div className="table-shell seller-auction-table"><Table><TableHeader><TableRow><TableHead>Auction</TableHead><TableHead>Status</TableHead><TableHead>Current / final</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{auctions.map((auction) => <TableRow key={auction.id}><TableCell><strong>{getProduct(auction).name || "Untitled auction"}</strong><small>{auction.id}</small></TableCell><TableCell><Badge className={`status-${auction.status.toLowerCase()}`}>{auction.status}</Badge></TableCell><TableCell className="history-amount">{formatMoney(auction.finalPrice || auction.currentBid || auction.startingPrice)}</TableCell><TableCell>{new Date(auction.startTime).toLocaleString("en-IN")}</TableCell><TableCell>{new Date(auction.endTime).toLocaleString("en-IN")}</TableCell><TableCell><AuctionActions auction={auction} /></TableCell></TableRow>)}</TableBody></Table></div><div className="seller-pagination"><Button variant="outline" disabled={pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {pagination.page} of {pagination.totalPages}</span><Button variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></>;
}
