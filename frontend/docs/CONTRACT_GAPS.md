# Backend contract gaps affecting the frontend

These are observations from the current backend code, not speculative frontend
features. Resolve them in the backend phase where they become blocking.

## 1. Socket.IO is not available through the API Gateway

The roadmap requires the browser to connect only to port `4000`, but Socket.IO
is attached to the Bidding Service HTTP server on port `4004`. The gateway's
proxy uses `fetch()` for JSON HTTP requests and has no WebSocket upgrade proxy.

Before real-time bidding, either:

1. add Socket.IO/WebSocket proxying at the gateway and keep
   `NEXT_PUBLIC_SOCKET_URL=http://localhost:4000`; or
2. explicitly approve a separate public Socket.IO origin for the Bidding
   Service.

The frontend foundation uses option 1 as the intended architecture.

## 2. Notification identity is not protected

The gateway marks `/api/v1/notifications` as unauthenticated and clears identity
headers on unauthenticated routes. Therefore `/notifications/mine` currently
depends on a caller-controlled `userId` query parameter. Any caller could ask
for another user's notification records.

Required backend fix: protect `/notifications/mine` at the gateway and derive
the user only from the verified `x-user-id` identity header.

## 3. Product management cannot list seller products

Product routes provide create, get-by-ID, and delete, but no list endpoint.
The planned seller products page needs something like:

```text
GET /api/v1/products?sellerId=<current-user>&page=1&limit=20
```

## 4. New users cannot become sellers through an API

Signup creates role `USER`, and profile updates only allow `name`. No current
endpoint requests, grants, or changes a seller role. Seller flows require seeded
seller accounts until a role-onboarding or admin role-management endpoint exists.

## 5. Auction history is a placeholder

`GET /auctions/:auctionId/history` returns an empty placeholder and directs the
caller to the Bidding Service. The auction details page should use
`GET /bids/auction/:auctionId` for bid history.

## 6. Planned socket events do not all exist

The current Socket.IO server emits only `bid:new` and `bid:outbid`. It does not
emit `AUCTION_STARTED`, `AUCTION_ENDED`, payment, or generic notification events.
Those UI states must initially use query invalidation/polling unless the backend
adds corresponding socket events.

## 7. Razorpay webhook raw-body handling needs verification

The gateway parses JSON and reserializes request bodies while Razorpay signature
verification requires the exact raw request bytes. Verify the webhook path end
to end before production. A direct raw-body route or raw-body-preserving gateway
proxy may be required.

## 8. Token storage policy is not finalized

The backend returns both access and refresh tokens in JSON request bodies. The
frontend HTTP layer intentionally does not hardcode localStorage. Phase 2 must
choose an explicit policy—prefer short-lived access tokens in memory and a more
secure refresh-token transport if the backend is updated to support HttpOnly
cookies.

