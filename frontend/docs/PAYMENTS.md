# Payment architecture

Phase 6 implements the BidX winner checkout flow without treating client-side
checkout completion as authoritative.

## Routes

| Route | Purpose |
| --- | --- |
| `/payments/:auctionId` | Winner checkout or seller payment tracking |
| `/dashboard/payments` | Authenticated winner/seller payment history |

The auction details page links to checkout only when the authenticated user is
the recorded winner. Sellers receive a read-only tracking link. Other users do
not receive payment controls.

## REST flow

1. Load the auction and verify that the current user is its winner or seller.
2. Load the latest participant-visible payment with
   `GET /payments/auction/:auctionId`.
3. A winner in `ENDED` or `PAYMENT_PENDING` requests an order using
   `POST /payments/order/:auctionId`.
4. For live mode, load Razorpay Checkout using the backend order and key.
5. Submit `orderId`, `paymentId`, and `signature` from Razorpay to
   `POST /payments/confirm`.
6. Show PAID only after that confirmation response, or after polling observes a
   backend webhook update.

The Payment Service independently checks its consumed AuctionWinner record.
Frontend winner checks control UX only and cannot authorize order creation.

## Razorpay handling

Razorpay Checkout is loaded only when a winner starts payment. Card and UPI
details remain inside Razorpay. The frontend receives only the signed checkout
identifiers required by the confirmation endpoint.

For a newly created live order, `keyIdForCheckout` comes from the backend. The
public environment key is a fallback for replaying an existing live order,
because the current replay response omits the checkout key.

## Payment states

- `CREATED`: order exists and payment/webhook polling continues every 10 seconds.
- `PAID`: backend verification completed; checkout actions are hidden.
- `FAILED`: the failed attempt remains visible and the winner may create another
  order through the backend.

Amounts are stored in minor units and displayed as `amountMinor / 100` in the
payment UI.

## Development mode

The frontend does not generate an HMAC signature or simulate PAID. The current
development adapter can create an order but cannot safely complete it from the
browser. This limitation and the required backend fix are documented in
`CONTRACT_GAPS.md`.
