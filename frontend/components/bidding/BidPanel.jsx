"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, Gavel, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBidSchema } from "@/features/bidding/schema";
import { usePlaceBid } from "@/features/bidding/hooks";
import useAuth from "@/hooks/useAuth";
import { formatMoney } from "@/utils/auction";
import { addDemoNotification } from "@/utils/demo-notifications";
import { createIdempotencyKey } from "@/utils/idempotency";

function errorCopy(error) {
  if (error?.status === 409) return "Another bid changed this auction just before yours. The latest price has been refreshed—review it and bid again.";
  if (error?.status === 429) return "The auction is processing another bid. Wait a moment, then try again.";
  if (error?.status === 403) return "You are not allowed to bid on this auction. Sellers cannot bid on their own listings.";
  return error?.message || "The bid could not be placed.";
}

export default function BidPanel({ auction, auctionId, minimum }) {
  const { user, isAuthenticated } = useAuth();
  const mutation = usePlaceBid(auctionId);
  const [success, setSuccess] = useState(null);
  const form = useForm({
    resolver: zodResolver(createBidSchema(minimum)),
    defaultValues: { amount: "" },
  });
  const isLive = auction.status === "LIVE";
  const isSeller = String(auction.sellerId) === String(user?.id);

  async function submit(values) {
    setSuccess(null);
    try {
      const data = await mutation.mutateAsync({
        auctionId,
        amount: values.amount,
        idempotencyKey: createIdempotencyKey(),
      });
      setSuccess(data);
      form.reset({ amount: "" });
      addDemoNotification(user.id, {
        eventId: `bid-accepted:${data.bid.id}`,
        type: "BID_ACCEPTED",
        auctionId,
        subject: `Bid accepted at ${formatMoney(data.auction.currentBid)}`,
        data: { amount: data.auction.currentBid },
      });
      toast.success(data.replayed ? "Your earlier bid was safely replayed." : `Bid accepted at ${formatMoney(data.auction.currentBid)}.`);
    } catch {
      // The mutation exposes the normalized error below and refreshes auction state.
    }
  }

  if (!isAuthenticated) {
    return <div className="bid-panel bid-panel-locked"><Gavel /><div><strong>Sign in to place a bid</strong><p>Bid history and live outbid alerts are available to authenticated users.</p></div><Button asChild className="primary-button"><Link href={`/login?next=${encodeURIComponent(`/auctions/${auctionId}`)}`}>Sign in to bid</Link></Button></div>;
  }

  if (!isLive || isSeller) {
    return <div className="bid-panel bid-panel-locked"><AlertTriangle /><div><strong>{isSeller ? "You cannot bid on your own auction" : "Bidding is closed"}</strong><p>{isSeller ? "The backend enforces this ownership rule." : `Current auction status: ${auction.status}.`}</p></div></div>;
  }

  return (
    <form className="bid-panel" onSubmit={form.handleSubmit(submit)} noValidate>
      <div className="bid-panel-heading"><Gavel /><div><strong>Place your bid</strong><p>Minimum accepted amount: {formatMoney(minimum)}</p></div></div>
      <div className="bid-control"><span>₹</span><Input type="number" min={minimum} step="1" inputMode="numeric" placeholder={String(minimum)} aria-label="Bid amount" {...form.register("amount")} /><Button type="submit" className="primary-button" disabled={mutation.isPending}>{mutation.isPending ? <><LoaderCircle className="spin" /> Placing…</> : "Place bid"}</Button></div>
      {form.formState.errors.amount && <p className="bid-message bid-message-error"><AlertTriangle />{form.formState.errors.amount.message}</p>}
      {mutation.error && <p className="bid-message bid-message-error"><AlertTriangle />{errorCopy(mutation.error)}</p>}
      {success && <p className="bid-message bid-message-success"><CheckCircle2 />Bid confirmed by the backend at {formatMoney(success.auction.currentBid)}{success.replayed ? " (idempotent replay)" : ""}.</p>}
      <p className="bid-assurance"><ShieldCheck /> BidX waits for Redis lock, OCC, MongoDB, and the API response before showing success.</p>
    </form>
  );
}
