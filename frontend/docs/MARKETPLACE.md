# BidX marketplace frontend

## Data flow

```text
Homepage / listing / detail
        ↓ auction hooks
features/auctions/api.js
        ↓
GET /auctions or /auctions/:id
        ↓
API Gateway → Auction Service
```

```text
Search input
    ↓ 300ms debounce
GET /search/suggest
    ↓ selected query
GET /search
    ↓
API Gateway → Search Service → Elasticsearch
```

## Routes

| Route | Backend source | Capabilities |
| --- | --- | --- |
| `/` | `GET /auctions` | Live and scheduled auction sections |
| `/auctions` | `GET /auctions` | Status/category filters, page size, pagination |
| `/auctions/:auctionId` | `GET /auctions/:auctionId` | Gallery, product, state, price rules, timer, seller |
| `/search` | `GET /search`, `GET /search/suggest` | Full Elasticsearch filters, sorting, pagination, autocomplete |

Every route uses the centralized Axios client and TanStack Query cache. The
frontend contains no fallback auction catalog. When the gateway is unavailable,
the page shows a retryable contract-aware error instead of presenting mock data.

## Search rules

- Autocomplete waits 300ms and does not query for fewer than two characters.
- Full search forwards only the filters supported by the backend contract.
- Price filters apply to `startingPrice`, matching the current Elasticsearch mapping.
- Draft auctions are never returned by public search.

## Phase boundary

The auction details page calculates and displays the next valid bid, but it does
not pretend to place bids. Phase 4 will add authenticated bid submission,
idempotency keys, bid history, `409` concurrency handling, and Socket.IO cache
updates. Backend confirmation remains mandatory before any successful bid UI.

