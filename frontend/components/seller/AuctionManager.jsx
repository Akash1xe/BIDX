"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, LoaderCircle, Play, Save, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import FormField from "@/components/auth/FormField";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuction, useDeleteAuction, useEndAuction, useStartAuction, useUpdateAuction } from "@/features/auctions/hooks";
import { toAuctionPayload, updateAuctionSchema } from "@/features/auctions/schema";
import useAuth from "@/hooks/useAuth";
import { formatMoney, getProduct } from "@/utils/auction";

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function ManagerForm({ auction }) {
  const router = useRouter();
  const update = useUpdateAuction(auction.id);
  const start = useStartAuction(auction.id);
  const end = useEndAuction(auction.id);
  const remove = useDeleteAuction(auction.id);
  const editable = ["DRAFT", "SCHEDULED"].includes(auction.status);
  const form = useForm({ resolver: zodResolver(updateAuctionSchema), defaultValues: { startingPrice: auction.startingPrice, minimumIncrement: auction.minimumIncrement, startTime: localDateTime(auction.startTime), endTime: localDateTime(auction.endTime) } });

  async function run(mutation, success, after) {
    try { await mutation.mutateAsync(); toast.success(success); after?.(); }
    catch (error) { toast.error(error.message); }
  }

  async function submit(values) {
    try { await update.mutateAsync(toAuctionPayload(values)); toast.success("Auction settings updated."); }
    catch { /* Normalized error below. */ }
  }

  return <><div className="manager-summary"><div><Badge className={`status-${auction.status.toLowerCase()}`}>{auction.status}</Badge><h2>{getProduct(auction).name}</h2><p>Current bid <strong>{formatMoney(auction.currentBid || auction.startingPrice)}</strong></p></div><Button asChild variant="outline"><Link href={`/auctions/${auction.id}`}>Public page <ArrowUpRight /></Link></Button></div><form className="seller-form manager-form" onSubmit={form.handleSubmit(submit)}><div className="seller-form-grid"><FormField id="manage-price" label="Starting price (₹)" error={form.formState.errors.startingPrice?.message}><Input id="manage-price" type="number" disabled={!editable} {...form.register("startingPrice")} /></FormField><FormField id="manage-increment" label="Minimum increment (₹)" error={form.formState.errors.minimumIncrement?.message}><Input id="manage-increment" type="number" disabled={!editable} {...form.register("minimumIncrement")} /></FormField><FormField id="manage-start" label="Start time" error={form.formState.errors.startTime?.message}><Input id="manage-start" type="datetime-local" disabled={!editable} {...form.register("startTime")} /></FormField><FormField id="manage-end" label="End time" error={form.formState.errors.endTime?.message}><Input id="manage-end" type="datetime-local" disabled={!editable} {...form.register("endTime")} /></FormField></div>{!editable && <p className="seller-contract-note">The backend locks price and timing after an auction becomes LIVE.</p>}{update.error && <p className="seller-form-error">{update.error.message}</p>}{editable && <Button className="primary-button seller-submit" disabled={update.isPending}>{update.isPending ? <LoaderCircle className="spin" /> : <Save />} Save changes</Button>}</form><div className="manager-actions">{editable && <Button className="primary-button" disabled={start.isPending} onClick={() => run(start, "Auction is now live.")}><Play /> Start auction</Button>}{auction.status === "LIVE" && <Button className="primary-button" disabled={end.isPending} onClick={() => run(end, "Auction ended.")}><Square /> End auction</Button>}{auction.status === "DRAFT" && <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive"><Trash2 /> Delete draft</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this draft?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. BidX rejects deletion after the auction leaves DRAFT.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => run(remove, "Draft deleted.", () => router.replace("/seller/auctions"))}>Delete draft</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div></>;
}

export default function AuctionManager() {
  const auctionId = useParams()?.auctionId;
  const { user } = useAuth();
  const query = useAuction(auctionId);
  if (query.isLoading) return <div className="manager-loading"><Skeleton className="details-title-skeleton" /><Skeleton className="details-panel-skeleton" /></div>;
  if (query.isError) return <div className="history-error"><strong>Auction unavailable</strong><p>{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>;
  if (String(query.data.sellerId) !== String(user.id)) return <div className="history-error"><strong>This is not your auction</strong><p>The frontend has hidden seller controls. The backend also enforces ownership on every write.</p><Button asChild variant="outline"><Link href="/seller/auctions">Return to your auctions</Link></Button></div>;
  return <ManagerForm auction={query.data} />;
}
