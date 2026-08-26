# BidX frontend architecture

## Request flow

```text
Page / Component
      ↓
Feature hook (React Query)
      ↓
Feature API module
      ↓
services/api-client.js
      ↓
lib/axios.js
      ↓
API Gateway
```

Components never call Axios directly. React Query owns server-state caching;
local React state is reserved for UI state such as open dialogs and form input.

## Folder ownership

```text
app/          Routes, layouts, loading and error boundaries
components/   Reusable presentation and layout components
features/     Business modules: API, hooks, schemas, feature components
hooks/        Hooks shared across multiple features
providers/    React context and application providers
services/     Transport-independent API helpers and auth bridge
lib/          Configured third-party clients and environment parsing
utils/        Pure reusable helper functions
constants/    Roles, routes and React Query keys
types/        Shared JSDoc shapes (runtime validation stays in Zod)
docs/         Verified contracts and architecture decisions
public/       Static assets
```

## Phase boundaries

- **Phase 1:** foundation, dependencies, environment, Axios, React Query, API docs.
- **Phase 2:** authentication service, schemas, provider and pages — complete.
- **Phase 3:** marketplace, auction listing/details and search — complete.
- **Phase 4:** confirmed bid placement, idempotency, authenticated history,
  Socket.IO cache updates, outbid alerts, timers and My Bids — complete.
- **Phase 5:** seller dashboard, product creation, auction creation and auction
  lifecycle management — complete.
- **Phase 6:** winner checkout, Razorpay confirmation, payment status and
  participant history — complete.
- **Phase 7:** notification center, unread indicators and delivery alerts —
  complete.
- **Phase 8:** admin statistics, user moderation, auction inspection and audit
  history — complete.
- **Phase 9:** session and response security, recovery states, containers,
  production checks, deployment guidance and release gates — complete.

All planned frontend phases are complete. Remaining launch work is backend
contract hardening and an authenticated staging run with seeded role accounts.

## Phase 4 server-state flow

Bid forms never optimistically claim success. The component calls the bidding
mutation, the backend completes its lock/OCC/database flow, and only the
successful response updates React Query. Socket events update the same cache for
other connected clients. A 15-second auction/history refresh remains active as a
fallback while the gateway WebSocket gap is unresolved.

## Phase 7 notification-state flow

`NotificationProvider` owns the current user's delivery feed and unread count.
It polls `GET /notifications/mine` every 15 seconds because the backend does not
emit notification socket events. The first successful response establishes a
baseline; later unseen records produce a toast. `OUTBID` records do not produce
a second toast because `RealtimeProvider` already handles `bid:outbid`.

The Notification Service stores email-delivery records, not in-app read state.
Read IDs are persisted per user on the current device behind the provider. That
keeps a future migration to server-backed read state contained.
