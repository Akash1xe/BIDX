"use client";

import Link from "next/link";
import { ArrowUpRight, CreditCard, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePayments } from "@/features/payments/hooks";
import useAuth from "@/hooks/useAuth";
import { formatPaymentAmount, paymentRole } from "@/utils/payment";

export default function PaymentHistory() {
  const { user } = useAuth();
  const query = usePayments(1);
  if (query.isLoading) return <div className="history-loading"><LoaderCircle className="spin" /> Loading payment history…</div>;
  if (query.isError) return <div className="history-error"><strong>Payment history unavailable</strong><p>{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>;
  const payments = query.data?.items || [];
  if (!payments.length) return <div className="my-bids-empty"><CreditCard /><h2>No payments yet</h2><p>Orders appear here after a winner starts checkout.</p><Button asChild className="primary-button"><Link href="/auctions">Browse auctions</Link></Button></div>;

  return <div className="table-shell payment-history-table"><Table><TableHeader><TableRow><TableHead>Auction</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Role</TableHead><TableHead>Mode</TableHead><TableHead>Created</TableHead><TableHead /></TableRow></TableHeader><TableBody>{payments.map((payment) => <TableRow key={payment.id}><TableCell><strong>{`Auction •••${payment.auctionId.slice(-6)}`}</strong><small>{payment.orderId}</small></TableCell><TableCell className="history-amount">{formatPaymentAmount(payment)}</TableCell><TableCell><Badge className={`payment-${payment.status.toLowerCase()}`}>{payment.status}</Badge></TableCell><TableCell>{paymentRole(payment, user.id)}</TableCell><TableCell>{payment.mode.toUpperCase()}</TableCell><TableCell>{new Date(payment.createdAt).toLocaleString("en-IN")}</TableCell><TableCell><Button asChild variant="ghost" size="icon-sm"><Link href={`/payments/${payment.auctionId}`} aria-label="Open payment"><ArrowUpRight /></Link></Button></TableCell></TableRow>)}</TableBody></Table></div>;
}
