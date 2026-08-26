# Notification architecture

## Verified backend contract

| Method | Route | Current inputs | Response |
| --- | --- | --- | --- |
| GET | `/notifications/mine` | `userId`, `limit`, `offset` | Record array |
| GET | `/notifications/auction/:auctionId` | Auction path ID | Record array |
| GET | `/notifications/stats` | None | Delivery statistics |

A record can contain `_id`, `eventId`, `type`, `userId`, `auctionId`, `subject`,
`status`, `provider`, `providerMessageId`, `error`, `data`, and `sentAt`.
Delivery status is `SENT`, `FAILED`, or `SKIPPED`. These describe email delivery,
not a dedicated in-app notification model.

## Frontend flow

`NotificationProvider` requests the authenticated user's feed and shares the
records, unread count, query state, `markRead(id)`, and `markAllRead()`. The bell
shows recent records; the notification center provides All and Unread views.
Auction-linked records navigate to their auction.

The query refreshes every 15 seconds because the backend emits no notification
socket event. The first response is a silent baseline; records discovered later
produce toasts. `OUTBID` is excluded because `bid:outbid` already alerts the
active browser.

## Read state

The backend provides no read field or mutation. Read IDs are stored per user in
browser local storage and therefore do not synchronize across devices. The
provider boundary allows a future server-backed implementation without changing
consuming components.

## Security limitation

The gateway currently treats notification routes as public, and
`/notifications/mine` accepts a caller-controlled `userId`. The frontend only
sends its authenticated session's ID, but that does not secure the API. Before
production, require authentication and derive identity from verified headers.
