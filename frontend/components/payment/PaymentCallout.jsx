"use client";

import Link from "next/link";
import { CreditCard, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import useAuth from "@/hooks/useAuth";
import { formatMoney } from "@/utils/auction";

const PAYMENT_STATUSES = ["ENDED", "PAYMENT_PENDING", "SOLD"];

export default function PaymentCallout({ auction }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !PAYMENT_STATUSES.includes(auction.status)) return null;
  const isWinner = String(auction.winningBidderId) === String(user.id);
  const isSeller = String(auction.sellerId) === String(user.id);
  if (!isWinner && !isSeller) return null;

  return <div className={`payment-callout ${isWinner ? "payment-callout-winner" : ""}`}>{isWinner ? <CreditCard /> : <ReceiptText />}<div><strong>{isWinner ? "Complete your winning payment" : "Track winner payment"}</strong><p>{isWinner ? `${formatMoney(auction.finalPrice || auction.currentBid)} is due for this auction.` : "Payment visibility is limited to the winner and seller."}</p></div><Button asChild className={isWinner ? "primary-button" : ""} variant={isWinner ? "default" : "outline"}><Link href={`/payments/${auction.id}`}>{isWinner ? "Pay now" : "View payment"}</Link></Button></div>;
}
