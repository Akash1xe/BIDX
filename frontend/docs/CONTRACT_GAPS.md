# Backend contract gaps affecting the frontend

These are observations from the current backend code, not speculative frontend
features. Resolve them in the backend phase where they become blocking.

## 1. Socket.IO gateway boundary — resolved in backend hardening

The API Gateway now proxies both Socket.IO polling requests and WebSocket
upgrades to the Bidding Service. The browser continues to use port `4000`, the
Bidding Service still verifies the handshake JWT, and production origins must
be explicitly allowlisted. The existing polling fallback remains useful during
temporary connection failures.

## 2. Notification identity — resolved in backend hardening

The gateway now authenticates notification routes, `/notifications/mine`
derives identity only from the verified gateway header, and auction-wide
records plus delivery statistics require `ADMIN`.

The service also has no read/unread fields or mark-read mutation. Phase 7 keeps
read IDs per authenticated user in device-local storage, so read state does not
follow a user across browsers or devices.

## 3. Seller product listing — resolved in seller contracts

The authenticated seller inventory endpoint is now:

```text
GET /api/v1/products/mine?page=1&limit=20&q=camera
```

It derives the seller only from verified gateway identity, never a caller-owned
query parameter. The frontend renders the real inventory and its pagination.

## 4. Seller onboarding — resolved in seller contracts

Verified users can call `POST /users/me/seller`. The operation is authenticated
and idempotent, preserves buyer access, clears the profile cache, and requires a
session refresh so the new access token contains the backend-issued role.

## 5. Auction history is a placeholder

`GET /auctions/:auctionId/history` returns an empty placeholder and directs the
caller to the Bidding Service. The auction details page should use
`GET /bids/auction/:auctionId` for bid history.

## 6. Planned socket events do not all exist

The current Socket.IO server emits only `bid:new` and `bid:outbid`. It does not
emit `AUCTION_STARTED`, `AUCTION_ENDED`, payment, or generic notification events.
Those UI states must initially use query invalidation/polling unless the backend
adds corresponding socket events.

Phase 7 polls the notification feed every 15 seconds. The first response is a
silent baseline; only later records create toasts. `OUTBID` records are excluded
because the existing `bid:outbid` socket handler already alerts the browser.

## 7. Razorpay raw webhook bytes — resolved in backend hardening

The gateway captures the webhook route before JSON parsing and forwards its
original buffer and content type. The Payment Service therefore verifies the
signature against the exact provider bytes.

## 10. Development payment orders cannot be safely confirmed by the frontend

When Razorpay server keys are absent, the Payment Service creates a `dev` order
but `/payments/confirm` still requires an HMAC signature created with the backend
key secret. The backend exposes neither a development confirmation endpoint nor
a signed development checkout payload.

The Phase 6 frontend therefore displays the development order but does not forge
the secret or claim payment success. Add a development-only backend endpoint
that returns a server-signed confirmation, or run the service with Razorpay test
keys for an end-to-end checkout.

## 11. Replayed live orders may omit the checkout key

The initial live `POST /payments/order/:auctionId` response includes
`keyIdForCheckout`. When an existing `CREATED` order is replayed, the service
returns the payment plus `replayed: true` but omits the key. The frontend falls
back to `NEXT_PUBLIC_RAZORPAY_KEY_ID`; configure it for reliable checkout resume.

## 8. HttpOnly refresh-token rotation — resolved in backend hardening

Login, signup, Google auth, and refresh now rotate the refresh credential in a
configurable `Secure`, `HttpOnly`, `SameSite` cookie. The gateway preserves the
cookie and enforces exact-Origin checks on cookie-backed refresh/logout. A
legacy JSON token remains optional for rolling upgrades; production disables it.

## 9. Google login has no frontend identity-provider configuration

The backend accepts `{ idToken }` at `POST /auth/google`, and the frontend API
function is implemented. A Google button is intentionally not shown yet because
the repository does not define the required public Google client ID or browser
identity-provider initialization. Add that configuration before enabling the UI;
never fabricate an ID token in the browser.

## 12. Admin statistics have no time-series data

`GET /admin/stats` returns current aggregate counts and GMV only. It does not
return dated buckets for users, auctions, bids, payments, or revenue. Phase 8
shows exact totals and derived current ratios instead of fabricating charts.
Add time-bucketed aggregation parameters or dedicated analytics endpoints before
building trend charts.

## 13. Admin audit records do not include request context

The current audit schema records actor, action, target, details, and time. It has
no IP address, request ID, result, or failure record. The Phase 8 audit table
therefore displays only verified stored fields.

## 14. Admin self-suspension — resolved in backend hardening

The Admin Service now rejects an administrator targeting its own user ID. The
existing frontend guard remains a UX safeguard, while the backend is authoritative.
