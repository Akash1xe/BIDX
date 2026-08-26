# BidX Frontend

Next.js App Router frontend for the BidX distributed auction platform.

## Phase status

Phase 1 — Foundation (complete):

- frontend dependencies installed;
- scalable folder architecture established;
- environment contract defined;
- centralized Axios client with interceptors created;
- React Query provider and query-key factory created;
- every current backend endpoint documented;
- frontend-blocking backend contract gaps recorded.

Phase 2 — Authentication (complete):

- login with Zod and React Hook Form validation;
- signup → send OTP → verify OTP → create account flow;
- shared AuthProvider and `useAuth()` hook;
- access-token injection and queued refresh-token rotation;
- idempotent logout and session cleanup;
- protected buyer, seller, and admin route boundaries;
- homepage navigation connected to the shared authenticated session.

Phase 3 — Marketplace (complete):

- homepage live and scheduled auctions use the real Auction API;
- searchable auction catalog with status, category, page-size, and pagination controls;
- auction details with product gallery, pricing rules, seller identity, status, and countdown;
- Elasticsearch search with keyword, status, category, condition, price, sort, and pagination;
- 300ms debounced search autocomplete;
- shared skeleton, empty, gateway-error, and retry states;
- legacy demo auction data and duplicate fetch client removed.

Phase 4 — Real-time bidding (complete):

- backend-confirmed bid placement with React Hook Form and dynamic Zod validation;
- a unique idempotency key on every bid attempt;
- explicit conflict, lock-contention, and authorization recovery states;
- authenticated auction bid history and protected My Bids workspace;
- Socket.IO auction-room join/leave, live cache updates, and outbid alerts;
- auction and bid-history polling fallback while gateway WebSocket proxying is pending;
- no optimistic bid success—the backend remains authoritative.

Phase 5 — Seller workspace (complete):

- seller dashboard driven by seller-filtered auction data;
- product creation with exact Product Service validation and conditions;
- returned product ID flows directly into draft auction creation;
- seller auction list with pagination, pricing, timing, and status;
- edit, start, end, view, and confirmed draft-deletion operations;
- frontend ownership checks plus backend-authoritative write authorization;
- accurate contract-gap state instead of a fabricated product inventory;
- responsive forms, tables, loading, error, empty, and success states.

Phase 6 — Payments (complete):

- winner-only payment entry point after an eligible auction ends;
- seller read-only payment tracking;
- backend order creation and idempotent order replay handling;
- lazy Razorpay Checkout loading with order, amount, and buyer prefill;
- signed checkout confirmation through the Payment Service;
- PAID state only after backend verification;
- webhook-aware polling for pending orders;
- authenticated winner/seller payment history;
- explicit development-mode and replay-key contract-gap handling.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Default configuration:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_RAZORPAY_KEY_ID=
```

## Architecture

```text
Page / Component
      ↓
Feature React Query hook
      ↓
Feature API module
      ↓
services/api-client.js
      ↓
lib/axios.js
      ↓
BidX API Gateway
```

Read:

- [Verified backend API contract](docs/API.md)
- [Frontend architecture](docs/FRONTEND_ARCHITECTURE.md)
- [Backend contract gaps](docs/CONTRACT_GAPS.md)
- [Authentication architecture](docs/AUTHENTICATION.md)
- [Marketplace architecture](docs/MARKETPLACE.md)
- [Bidding architecture](docs/BIDDING.md)
- [Seller workspace architecture](docs/SELLER.md)
- [Payment architecture](docs/PAYMENTS.md)

## Important rule

Components do not call Axios directly. Server state belongs to React Query, and
each feature owns its API functions, hooks, and Zod schemas.
