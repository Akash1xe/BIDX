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
- **Phase 2:** authentication service, schemas, provider and pages.
- **Phase 3:** marketplace, auction listing/details and search.
- **Phase 4:** bidding API, idempotency, Socket.IO and timers.
- **Phase 5+:** seller, payment, notifications, admin and production.

Do not create feature modules before their phase begins.

