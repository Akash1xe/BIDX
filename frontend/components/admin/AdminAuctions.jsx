"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AdminPagination from "@/components/admin/AdminPagination";
import { QueryEmpty, QueryError } from "@/components/feedback/QueryState";
import { useAdminAuctions } from "@/features/admin/hooks";
import { adminId, adminPagination, shortId } from "@/utils/admin";
import { formatMoney, getProduct } from "@/utils/auction";

const STATUSES = ["", "DRAFT", "SCHEDULED", "LIVE", "ENDED", "PAYMENT_PENDING", "SOLD", "UNSOLD"];

export default function AdminAuctions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const query = useAdminAuctions({ ...(status && { status }), page, limit: 20 });
  const pagination = adminPagination(query.data, page);

  return <div className="admin-list"><div className="admin-toolbar"><label>Status<NativeSelect value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><NativeSelectOption value="">All statuses</NativeSelectOption>{STATUSES.filter(Boolean).map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect></label><span>{query.isSuccess ? `${pagination.total} auction records` : "Loading records…"}</span></div>{query.isLoading && <div className="history-loading"><LoaderCircle className="spin" /> Loading auction records…</div>}{query.isError && <QueryError title="Admin auctions are unavailable" error={query.error} onRetry={() => query.refetch()} />}{query.isSuccess && !query.data?.items?.length && <QueryEmpty title="No auctions found" description="No backend records match this status." />}{query.isSuccess && query.data?.items?.length > 0 && <><div className="table-shell admin-table"><Table><TableHeader><TableRow><TableHead>Auction</TableHead><TableHead>Seller</TableHead><TableHead>Status</TableHead><TableHead>Current / final</TableHead><TableHead>Schedule</TableHead><TableHead /></TableRow></TableHeader><TableBody>{query.data.items.map((auction) => { const id = adminId(auction); return <TableRow key={id}><TableCell><strong>{getProduct(auction).name || "Untitled auction"}</strong><small>{shortId(id)} · {getProduct(auction).category || "Uncategorized"}</small></TableCell><TableCell>{shortId(auction.sellerId)}</TableCell><TableCell><Badge className={`status-${String(auction.status).toLowerCase()}`}>{auction.status}</Badge></TableCell><TableCell className="history-amount">{formatMoney(auction.finalPrice || auction.currentBid || auction.startingPrice)}</TableCell><TableCell><small>{new Date(auction.startTime).toLocaleString("en-IN")}</small><small>to {new Date(auction.endTime).toLocaleString("en-IN")}</small></TableCell><TableCell><Button asChild variant="ghost" size="icon-sm"><Link href={`/auctions/${id}`} aria-label="Inspect auction"><ArrowUpRight /></Link></Button></TableCell></TableRow>; })}</TableBody></Table></div><AdminPagination pagination={pagination} onPage={setPage} /></>}</div>;
}
