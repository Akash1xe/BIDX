# Admin workspace architecture

Phase 8 is restricted by `RoleGuard` to authenticated `ADMIN` sessions. This is
an interface boundary only; the gateway and Admin Service remain authoritative
and independently require the admin role for every route.

## Routes

| Frontend route | Backend contract | Purpose |
| --- | --- | --- |
| `/admin` | `GET /admin/stats` | Control-room overview |
| `/admin/stats` | `GET /admin/stats` | Aggregate marketplace statistics |
| `/admin/users` | `GET /admin/users`, `PATCH /admin/users/:id/suspend` | Account moderation |
| `/admin/auctions` | `GET /admin/auctions` | Auction inspection |
| `/admin/audit` | `GET /admin/audit` | Moderation audit trail |

## User moderation

The user table searches backend records by name or email and paginates at 20
records. Suspending sends `{ isSuspended: true, reason? }`; restoring sends
`{ isSuspended: false }`. The UI waits for backend confirmation, then refreshes
users, statistics, and audit queries. It never mutates the cache as if the
operation already succeeded.

The current admin cannot target itself through the interface because the backend
does not yet prevent self-suspension. This UX guard is not an authorization
control; the backend gap is documented separately.

## Auction inspection

The Admin Service supports status filtering and pagination but no admin auction
search or mutation. Phase 8 displays exact raw records and links to the existing
auction details route for deeper inspection. It does not invent moderation
actions absent from the service.

## Statistics and audit

Statistics are present-time aggregates. GMV uses `gmvMinor / 100`, matching the
Payment Service's minor-unit storage. Sold and seller ratios are derived only
from returned totals. Trend charts are omitted because there are no time-series
buckets.

Audit history displays stored `actorId`, `action`, target, reason, and time.
Request IP, result, and request ID are not displayed because the schema does not
contain them.
