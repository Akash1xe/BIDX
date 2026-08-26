"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CalendarClock, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import FormField from "@/components/auth/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAuctionSchema, toAuctionPayload } from "@/features/auctions/schema";
import { useCreateAuction } from "@/features/auctions/hooks";

export default function AuctionForm() {
  const params = useSearchParams();
  const router = useRouter();
  const createAuction = useCreateAuction();
  const form = useForm({
    resolver: zodResolver(createAuctionSchema),
    defaultValues: { productId: params.get("productId") || "", startingPrice: "", minimumIncrement: "", startTime: "", endTime: "" },
  });

  async function submit(values) {
    try {
      const auction = await createAuction.mutateAsync(toAuctionPayload(values));
      toast.success("Draft auction created.");
      router.push(`/seller/auctions/${auction.id}`);
    } catch {
      // Normalized API error is rendered below.
    }
  }

  return (
    <form className="seller-form" onSubmit={form.handleSubmit(submit)} noValidate>
      <div className="seller-form-heading"><CalendarClock /><div><h2>Auction contract</h2><p>New auctions are created as DRAFT. Review them before starting.</p></div></div>
      <div className="seller-form-grid">
        <div className="seller-form-span"><FormField id="auction-product" label="Product ID" error={form.formState.errors.productId?.message}><Input id="auction-product" placeholder="Paste the ID returned after product creation" {...form.register("productId")} /></FormField></div>
        <FormField id="auction-start-price" label="Starting price (₹)" error={form.formState.errors.startingPrice?.message}><Input id="auction-start-price" type="number" min="1" step="1" {...form.register("startingPrice")} /></FormField>
        <FormField id="auction-increment" label="Minimum increment (₹)" error={form.formState.errors.minimumIncrement?.message}><Input id="auction-increment" type="number" min="1" step="1" {...form.register("minimumIncrement")} /></FormField>
        <FormField id="auction-start-time" label="Start time" error={form.formState.errors.startTime?.message}><Input id="auction-start-time" type="datetime-local" {...form.register("startTime")} /></FormField>
        <FormField id="auction-end-time" label="End time" error={form.formState.errors.endTime?.message}><Input id="auction-end-time" type="datetime-local" {...form.register("endTime")} /></FormField>
      </div>
      <p className="seller-contract-note">The backend requires positive prices, permits a start time no more than five minutes in the past, and requires the end time to be later.</p>
      {createAuction.error && <p className="seller-form-error">{createAuction.error.message}</p>}
      <Button type="submit" className="primary-button seller-submit" disabled={createAuction.isPending}>{createAuction.isPending ? <><LoaderCircle className="spin" /> Creating draft…</> : <>Create draft auction <ArrowRight /></>}</Button>
    </form>
  );
}
