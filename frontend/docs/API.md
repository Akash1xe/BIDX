# BidX Frontend API Contract

Source of truth: the route, controller, service, and model files in
`Akash1xe/BIDX` on the `main` branch.

## Conventions

- Browser HTTP base URL: `http://localhost:4000/api/v1`
- Authenticated requests use `Authorization: Bearer <accessToken>`.
- Unless noted, success responses use:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {}
}
```

- Gateway errors use:

```json
{
  "success": false,
  "requestId": "uuid",
  "message": "Human-readable error",
  "details": {}
}
```

- Common status codes: `400` invalid input, `401` missing/invalid token, `403`
  insufficient role/ownership, `404` missing resource, `409` state or concurrent
  conflict, `429` rate limit/busy auction, `500` unexpected failure, `502/503`
  upstream or circuit-breaker failure.

## Authentication

| Method | Endpoint | Auth | Request | Returns | Expected errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/send-otp` | No | `{ email }` | `{ expiresInSeconds, devOtp? }` | 400, 429 |
| POST | `/auth/verify-otp` | No | `{ email, otp }` | `{ verified: true }` | 400, 429 |
| POST | `/auth/signup` | No | `{ name, email, password }` | `{ user, tokens }` | 400, 403, 409, 429 |
| POST | `/auth/login` | No | `{ email, password }` | `{ user, tokens }` | 400, 401, 403, 429 |
| POST | `/auth/google` | No | `{ idToken }` | `{ user, tokens }` | 400, 401, 500, 429 |
| POST | `/auth/refresh` | No | `{ refreshToken }` | `{ user, tokens }` | 400, 401 |
| POST | `/auth/logout` | No | `{ refreshToken? }` | `null` | Normally idempotent |

Token data:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "accessTokenExpiresIn": "15m",
  "refreshTokenExpiresIn": "7d"
}
```

Public user data:

```json
{
  "id": "mongo-id",
  "name": "Akash",
  "email": "akash@example.com",
  "role": "USER | SELLER | ADMIN",
  "isVerified": true
}
```

Important behavior:

1. OTP verification must happen before signup.
2. Passwords must contain at least eight characters.
3. Refresh tokens rotate. The old token must be replaced after every refresh.
4. Refresh-token reuse revokes all sessions belonging to that user.

## User profile

| Method | Endpoint | Auth | Request | Returns | Expected errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/users/me` | Bearer | None | `{ user, fromCache }` | 401, 404 |
| PUT | `/users/me` | Bearer | `{ name }` | `{ user }` | 400, 401, 404 |

Only `name` is currently editable.

## Products

| Method | Endpoint | Auth | Request | Returns | Expected errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/products` | SELLER/ADMIN | `{ name, description?, images?, category, condition? }` | Product | 400, 401, 403 |
| GET | `/products/:productId` | Optional bearer | None | Product | 404 |
| DELETE | `/products/:productId` | Owner bearer | None | `{ removed: true }` | 401, 403, 404 |

`condition` is one of `NEW`, `LIKE_NEW`, `USED`, or `REFURBISHED`.

Product response:

```json
{
  "id": "mongo-id",
  "name": "Leica M6",
  "description": "...",
  "images": ["https://..."],
  "category": "cameras",
  "condition": "USED",
  "sellerId": "mongo-id",
  "createdAt": "ISO date"
}
```

## Auctions

| Method | Endpoint | Auth | Request/query | Returns | Expected errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/auctions` | No | `status?, sellerId?, category?, page?, limit?` | `{ items, pagination }` | 400 |
| GET | `/auctions/:auctionId` | No | None | Auction | 404 |
| GET | `/auctions/:auctionId/history` | No | None | Placeholder history | 404 |
| POST | `/auctions` | SELLER/ADMIN | `{ productId, startingPrice, minimumIncrement, startTime, endTime }` | Auction | 400, 401, 403, 404 |
| PUT | `/auctions/:auctionId` | Owner SELLER/ADMIN | Any of `{ startingPrice, minimumIncrement, startTime, endTime }` | Auction | 400, 401, 403, 404, 409 |
| DELETE | `/auctions/:auctionId` | Owner SELLER/ADMIN | None | `{ removed: true }` | 401, 403, 404, 409 |
| POST | `/auctions/:auctionId/start` | Owner SELLER/ADMIN | None | Auction | 400, 401, 403, 404, 409 |
| POST | `/auctions/:auctionId/end` | Owner SELLER/ADMIN | None | Auction | 401, 403, 404, 409 |

`page` defaults to `1`; `limit` defaults to `20` and is capped at `50`.

Auction statuses:

```text
DRAFT → SCHEDULED or LIVE
SCHEDULED → LIVE or DRAFT
LIVE → ENDED
ENDED → PAYMENT_PENDING, SOLD, or UNSOLD
PAYMENT_PENDING → SOLD or ENDED
```

Auction response:

```json
{
  "id": "mongo-id",
  "product": {
    "name": "Leica M6",
    "description": "...",
    "images": [],
    "category": "cameras",
    "condition": "USED"
  },
  "sellerId": "mongo-id",
  "startingPrice": 100000,
  "currentBid": 120000,
  "highestBidderId": "mongo-id-or-null",
  "minimumIncrement": 1000,
  "startTime": "ISO date",
  "endTime": "ISO date",
  "startedAt": "ISO date-or-null",
  "endedAt": "ISO date-or-null",
  "winningBidderId": "mongo-id-or-null",
  "finalPrice": 0,
  "status": "LIVE"
}
```

## Search

| Method | Endpoint | Auth | Query | Returns | Expected errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/search` | No | `q?, status?, category?, condition?, sellerId?, minPrice?, maxPrice?, sort?, page?, limit?` | `{ results, facets, pagination, sort }` | 400, 503 |
| GET | `/search/suggest` | No | `q` | `{ suggestions }` | 503 |
| GET | `/search/health` | No | None | Health payload | 503 when degraded |

Rules:

- `status` accepts comma-separated values. `DRAFT` is never publicly searchable.
- `sort` accepts `relevance`, `price_asc`, `price_desc`, `ending_soon`, or `newest`.
- Full search `limit` is capped at `50`; suggestions return at most `8` items.
- Search price filters currently target `startingPrice`.

Search result item fields are indexed event data and include `auctionId`,
`productId`, `sellerId`, `name`, `description`, `images`, `category`,
`condition`, `startingPrice`, `minimumIncrement`, `currentPrice`, `bidCount`,
`status`, `startTime`, and `endTime`.

## Bidding

| Method | Endpoint | Auth | Request/query | Returns | Expected errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/bids` | Bearer | Header `Idempotency-Key`; body `{ auctionId, amount }` | `{ bid, auction, replayed }` | 400, 401, 403, 404, 409, 429 |
| GET | `/bids/mine` | Bearer | `page?, limit?` | `{ items, pagination }` | 401 |
| GET | `/bids/auction/:auctionId` | Bearer | `page?, limit?` | `{ items, pagination }` | 401 |

Bid amount must be a positive integer. The minimum accepted bid is:

```text
currentBid > 0
    ? currentBid + minimumIncrement
    : startingPrice
```

Successful bid response:

```json
{
  "bid": {
    "id": "mongo-id",
    "auctionId": "mongo-id",
    "bidderId": "mongo-id",
    "amount": 121000,
    "status": "ACCEPTED",
    "createdAt": "ISO date"
  },
  "auction": {
    "currentBid": 121000,
    "highestBidderId": "mongo-id",
    "version": 4
  },
  "replayed": false
}
```

## Payment

| Method | Endpoint | Auth | Request/query | Returns | Expected errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/payments/order/:auctionId` | Winning user | None | Payment plus `keyIdForCheckout` and `replayed` | 401, 404, 409 |
| POST | `/payments/confirm` | Winning user | `{ orderId, paymentId, signature }` | Payment plus `alreadyPaid` | 400, 401, 403, 404 |
| GET | `/payments/mine` | Bearer | `page?, limit?` | `{ items, pagination }` | 401 |
| GET | `/payments/auction/:auctionId` | Winner/seller | None | Payment | 401, 403, 404 |
| POST | `/payments/webhook` | Razorpay signature | Raw body; header `x-razorpay-signature` | `{ received, matched }` | 400, 401 |

Payment statuses: `CREATED`, `PAID`, `FAILED`. Amounts use minor units, so
`amountMinor / 100` is the INR display amount.

## Notifications

| Method | Endpoint | Gateway auth | Request/query | Returns |
| --- | --- | --- | --- | --- |
| GET | `/notifications/mine` | Currently public | `userId`, `limit?`, `offset?` | Notification array |
| GET | `/notifications/auction/:auctionId` | Currently public | None | Notification array |
| GET | `/notifications/stats` | Currently public | None | Delivery statistics |

Unlike other domains, notification responses do not consistently include a
`message`. Missing `userId` returns `{ success: false, error: "userId required" }`.
Records expose `_id`, `eventId`, `type`, `userId`, optional `auctionId`, optional
`subject`, `status`, `provider`, `providerMessageId`, `error`, `data`, and
`sentAt`. Status is one of `SENT`, `FAILED`, or `SKIPPED`.

There is no notification read/unread field, mark-read endpoint, or generic
notification Socket.IO event. The frontend polls and keeps read state locally.

## Admin

Every admin route requires a valid bearer token with role `ADMIN`.

| Method | Endpoint | Request/query | Returns | Expected errors |
| --- | --- | --- | --- | --- |
| GET | `/admin/users` | `q?, page?, limit?` | `{ items, total, page, limit }` | 401, 403 |
| PATCH | `/admin/users/:id/suspend` | `{ isSuspended, reason? }` | `{ matched, modified }` | 401, 403, 404 |
| GET | `/admin/auctions` | `status?, page?, limit?` | `{ items, total, page, limit }` | 401, 403 |
| GET | `/admin/stats` | None | Aggregate marketplace statistics | 401, 403 |
| GET | `/admin/audit` | `page?, limit?` | `{ items, total, page, limit }` | 401, 403 |

Admin statistics fields are `users`, `sellers`, `suspendedUsers`, `auctions`,
`liveAuctions`, `soldAuctions`, `bids`, `paidPayments`, and `gmvMinor`.

Admin user and auction lists return raw MongoDB records with `_id`, rather than
the public-domain `id` shape. User records exclude `password` and `otpHash`.
Audit records contain `_id`, `actorId`, `action`, optional `targetType`, optional
`targetId`, `details`, and `createdAt`.

## Socket.IO contract

The Bidding Service hosts Socket.IO at path `/socket.io`. The handshake requires
the access token in `auth.token` or the `Authorization` header.

Client events:

| Event | Payload | Acknowledgement |
| --- | --- | --- |
| `auction:join` | `auctionId` string | `{ joined }` or `{ error }` |
| `auction:leave` | `auctionId` string | None |

Server events:

| Event | Payload |
| --- | --- |
| `bid:new` | `{ auctionId, bidId, bidderId, amount, previousAmount, previousHighestBidderId, currentBid, createdAt }` |
| `bid:outbid` | `{ auctionId, amount, bidderId }` |

The current API Gateway does not proxy WebSocket upgrades. See
[`CONTRACT_GAPS.md`](./CONTRACT_GAPS.md) before Phase 4.
