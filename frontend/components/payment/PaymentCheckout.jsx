"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, LoaderCircle, LockKeyhole, ReceiptText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuction } from "@/features/auctions/hooks";
import { useAuctionPayment, useConfirmPayment, useCreatePaymentOrder } from "@/features/payments/hooks";
import useAuth from "@/hooks/useAuth";
import { env } from "@/lib/env";
import { loadRazorpayCheckout } from "@/lib/razorpay";
import { formatMoney, getProduct } from "@/utils/auction";
import { formatPaymentAmount } from "@/utils/payment";

const PAYABLE_STATES = ["ENDED", "PAYMENT_PENDING"];

export default function PaymentCheckout() {
  const auctionId = useParams()?.auctionId;
  const { user } = useAuth();
  const auctionQuery = useAuction(auctionId);
  const auction = auctionQuery.data;
  const isWinner = String(auction?.winningBidderId) === String(user.id);
  const isSeller = String(auction?.sellerId) === String(user.id);
  const paymentQuery = useAuctionPayment(auctionId, Boolean(auction && (isWinner || isSeller)));
  const createOrder = useCreatePaymentOrder(auctionId);
  const confirmPayment = useConfirmPayment(auctionId);
  const [checkoutError, setCheckoutError] = useState("");
  const [isOpening, setIsOpening] = useState(false);

  async function beginCheckout() {
    setCheckoutError("");
    setIsOpening(true);
    let checkoutOpened = false;
    try {
      const order = await createOrder.mutateAsync();
      if (order.status === "PAID") {
        toast.success("This auction is already paid.");
        return;
      }
      if (order.mode !== "live") {
        setCheckoutError("The backend created a development-mode order, but it does not expose a signed mock-confirmation endpoint. BidX will not forge a payment signature in the browser.");
        return;
      }
      const key = order.keyIdForCheckout || env.razorpayKeyId;
      if (!key) {
        setCheckoutError("Razorpay is live on the backend, but the checkout key is unavailable. Configure NEXT_PUBLIC_RAZORPAY_KEY_ID to resume an existing order.");
        return;
      }

      const Razorpay = await loadRazorpayCheckout();
      const checkout = new Razorpay({
        key,
        amount: order.amountMinor,
        currency: order.currency,
        name: "BidX",
        description: `Winning auction payment · ${getProduct(auction).name}`,
        order_id: order.orderId,
        prefill: { name: user.name, email: user.email },
        theme: { color: "#ef5d3f" },
        handler: async (response) => {
          try {
            await confirmPayment.mutateAsync({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            toast.success("Payment verified by the BidX backend.");
          } catch (error) {
            setCheckoutError(error.message);
            toast.error("Checkout returned, but backend verification failed.");
          } finally {
            setIsOpening(false);
          }
        },
        modal: { ondismiss: () => setIsOpening(false) },
      });
      checkout.on("payment.failed", (response) => {
        setCheckoutError(response.error?.description || "Razorpay reported a failed payment.");
        setIsOpening(false);
      });
      checkout.open();
      checkoutOpened = true;
    } catch (error) {
      setCheckoutError(error.message);
    } finally {
      if (!checkoutOpened) setIsOpening(false);
    }
  }

  if (auctionQuery.isLoading) return <div className="payment-loading"><Skeleton className="details-title-skeleton" /><Skeleton className="details-panel-skeleton" /></div>;
  if (auctionQuery.isError) return <div className="history-error"><strong>Auction unavailable</strong><p>{auctionQuery.error.message}</p><Button variant="outline" onClick={() => auctionQuery.refetch()}>Try again</Button></div>;
  if (!isWinner && !isSeller) return <div className="payment-access"><LockKeyhole /><h2>Payment access is restricted</h2><p>Only the recorded winner or seller can view this auction’s payment.</p><Button asChild variant="outline"><Link href={`/auctions/${auctionId}`}>Return to auction</Link></Button></div>;

  const payment = paymentQuery.data;
  const noPaymentYet = paymentQuery.error?.status === 404;
  const paid = payment?.status === "PAID";
  const canPay = isWinner && PAYABLE_STATES.includes(auction.status) && !paid;

  return (
    <div className="payment-checkout-shell">
      <section className="payment-order-card">
        <div className="payment-order-heading"><div><p className="eyebrow">Winning order</p><h2>{getProduct(auction).name}</h2></div><Badge className={`status-${auction.status.toLowerCase()}`}>{auction.status}</Badge></div>
        <div className="payment-total"><span>Amount due</span><strong>{payment ? formatPaymentAmount(payment) : formatMoney(auction.finalPrice || auction.currentBid)}</strong></div>
        <dl className="payment-facts"><div><dt>Auction</dt><dd>{auction.id}</dd></div><div><dt>Winner</dt><dd>{auction.winningBidderId}</dd></div>{payment && <><div><dt>Order</dt><dd>{payment.orderId}</dd></div><div><dt>Mode</dt><dd>{payment.mode.toUpperCase()}</dd></div></>}</dl>
        {paymentQuery.isLoading && <div className="history-loading"><LoaderCircle className="spin" /> Checking payment status…</div>}
        {paymentQuery.isError && !noPaymentYet && <p className="seller-form-error">{paymentQuery.error.message}</p>}
        {paid && <div className="payment-confirmed"><CheckCircle2 /><div><strong>Payment verified</strong><p>The backend marked this order PAID{payment.paymentId ? ` with provider payment ${payment.paymentId}` : ""}.</p></div></div>}
        {!paid && payment && <div className="payment-pending"><ReceiptText /><div><strong>{payment.status === "FAILED" ? "Previous attempt failed" : "Payment order created"}</strong><p>Status: {payment.status}. Webhook polling remains active while the order is pending.</p></div></div>}
        {canPay && <Button className="primary-button payment-button" onClick={beginCheckout} disabled={createOrder.isPending || confirmPayment.isPending || isOpening}>{createOrder.isPending || isOpening ? <><LoaderCircle className="spin" /> Opening secure checkout…</> : <><CreditCard /> {payment?.status === "CREATED" ? "Continue checkout" : "Create order and pay"}</>}</Button>}
        {isWinner && !PAYABLE_STATES.includes(auction.status) && !paid && <div className="payment-warning"><AlertTriangle />Payment is unavailable while the auction status is {auction.status}.</div>}
        {isSeller && !isWinner && !payment && noPaymentYet && <div className="payment-pending"><ReceiptText /><div><strong>No payment order yet</strong><p>The winner has not started checkout.</p></div></div>}
        {checkoutError && <div className="payment-warning"><AlertTriangle />{checkoutError}</div>}
      </section>
      <aside className="payment-security-card"><ShieldCheck /><h3>Backend-authoritative checkout</h3><ol><li>The winner requests an order from BidX.</li><li>Razorpay collects payment details securely.</li><li>BidX verifies the signed Razorpay response.</li><li>Only then does this screen show PAID.</li></ol><p>No card or UPI details pass through this frontend.</p></aside>
    </div>
  );
}
