# Bidding architecture

Phase 4 follows the contracts implemented by the BidX Bidding Service. The
browser still uses the API Gateway as its only backend origin.

## REST contract

| Action | Request | Authentication | Frontend behavior |
| --- | --- | --- | --- |
| Place bid | `POST /bids` with `{ auctionId, amount }` | Required | Sends a unique `Idempotency-Key`; shows success only after the response |
| Auction history | `GET /bids/auction/:auctionId?page=1&limit=20` | Required | Cached by auction and page; refreshed every 15 seconds |
| My bids | `GET /bids/mine?page=1&limit=20` | Required | Cached by page; refreshed every 20 seconds |

A successful bid response contains `{ bid, auction, replayed }`. The mutation
updates the auction price and bid-history caches, then invalidates catalog,
search, and My Bids queries.

The frontend gives specific recovery instructions for important backend states:

- `409`: another bid or auction state won the race; refresh current state and ask
  the user to review before retrying.
- `429`: the auction lock is busy; wait briefly before retrying.
- `403`: the authenticated user is not eligible, including a seller bidding on
  their own auction.

## Socket contract

The client authenticates with the access token in the Socket.IO handshake,
emits `auction:join` when opening a detail route, and emits `auction:leave` when
leaving it.

`bid:new` updates the auction cache and prepends a deduplicated accepted bid to
the history cache. `bid:outbid` invalidates current state and shows a toast with
a direct link back to the auction.

The current backend does not emit auction start/end events, so timers and query
refreshes remain responsible for those state changes.

## Consistency rule

There is no optimistic bid success. The button enters a `Placing…` state while
the request is pending. BidX only renders the confirmation after the backend
returns success or reports an idempotent replay. On failure, the current auction
and history are invalidated so the user sees the newest authoritative price.

## Gateway fallback

Socket.IO currently terminates on the Bidding Service while the Gateway does not
proxy WebSocket upgrades. The frontend intentionally keeps
`NEXT_PUBLIC_SOCKET_URL` pointed at the Gateway and displays `REST refresh
active` when it cannot connect. Auction and history polling provide safe state
convergence until WebSocket proxying is added at the Gateway.
