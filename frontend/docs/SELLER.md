# Seller workspace architecture

Phase 5 implements seller features against the Auction Service contract and
keeps all browser traffic on the API Gateway.

## Routes

| Route | Capability |
| --- | --- |
| `/seller` | Seller metrics and entry points |
| `/seller/products` | Searchable, paginated owned product inventory |
| `/seller/products/create` | Create an owned product |
| `/seller/auctions` | Paginated seller-owned auction management |
| `/seller/auctions/create` | Create a DRAFT auction |
| `/seller/auctions/:auctionId` | Edit eligible fields and perform lifecycle actions |

All routes allow `SELLER` and `ADMIN` sessions at the UX boundary. Auction
ownership is checked in the interface and rechecked authoritatively by the
backend.

## Product flow

The create form sends the exact backend fields: `name`, `description`,
`images`, `category`, and `condition`. Conditions are restricted to `NEW`,
`LIKE_NEW`, `USED`, and `REFURBISHED`.

On success, the frontend displays the returned product ID and links to auction
creation with that ID prefilled. `GET /products/mine` returns only products
owned by the authenticated seller and supports search and pagination.

## Auction flow

Auction creation requires `productId`, `startingPrice`, `minimumIncrement`,
`startTime`, and `endTime`. Client validation checks positive prices and a valid
time window; the backend remains authoritative for ownership, clock tolerance,
and status transitions.

The management UI follows the implemented transition rules:

- DRAFT or SCHEDULED: edit pricing/timing and start.
- DRAFT: delete with confirmation.
- LIVE: end the auction.
- Later states: inspect only.

Every successful mutation invalidates auction and search caches. API conflicts
are shown as backend messages rather than pretending a transition succeeded.

## Dashboard metrics

Active and completed counts come from `GET /auctions?sellerId=<userId>`. Sold
value sums `finalPrice` only for `SOLD` auctions. It is deliberately labelled
sold value—not revenue—because verified payment revenue belongs to Phase 6.
Product count comes from the owned inventory pagination metadata.
