# BidX release checklist

## Configuration

- [ ] HTTPS frontend and gateway origins configured.
- [ ] CORS allows the exact frontend origin, not `*`.
- [ ] JWT access and refresh secrets are long, random, and unrelated.
- [ ] Razorpay test/live keys match the deployment environment.
- [ ] Razorpay webhook preserves the exact raw request body.
- [ ] Notification routes require gateway authentication.
- [ ] Gateway proxies Socket.IO upgrades or a separately approved socket origin exists.
- [ ] MongoDB, Redis, Kafka, and Elasticsearch use persistent storage and private networking.

## Automated gates

- [ ] Frontend lint passes with no errors.
- [ ] Production-hardening tests pass.
- [ ] Production build passes.
- [ ] Read-only gateway smoke checks pass.
- [ ] Container health checks become healthy.

## Buyer flow

- [ ] Signup → OTP verification → authenticated session.
- [ ] Login, refresh after reload, and logout/revocation.
- [ ] Browse, filter, search, and autocomplete using gateway data.
- [ ] Place a valid bid and observe backend-confirmed state.
- [ ] Receive conflict/outbid handling without false optimistic success.
- [ ] View My Bids and notification delivery records.
- [ ] Winner opens Razorpay, backend confirms signature, and history shows PAID.

## Seller flow

- [ ] Seller guard rejects USER sessions.
- [ ] Create a product and carry its returned ID into auction creation.
- [ ] Create, edit, start, end, inspect, and delete an eligible draft.
- [ ] Observe bids and winner payment without unauthorized mutations.

## Admin flow

- [ ] Non-admin sessions receive backend 403 responses.
- [ ] Load aggregate statistics and GMV.
- [ ] Search users, suspend another user, and restore access.
- [ ] Confirm the audit entry appears after moderation.
- [ ] Filter and inspect auction records.
- [ ] Confirm the interface never offers self-suspension.

## Failure and recovery

- [ ] Verify 401, 403, 404, 409, 422, 429, and 500 messages.
- [ ] Disconnect the network and verify the offline banner.
- [ ] Reconnect and verify REST queries converge.
- [ ] Stop WebSocket proxying and verify the polling fallback remains usable.
- [ ] Confirm unknown routes render the BidX 404 state.
- [ ] Confirm an unexpected render failure can retry through the error boundary.

## Rollout

- [ ] Back up persistent stores before schema or infrastructure changes.
- [ ] Deploy to a test environment and complete every flow above.
- [ ] Record the last known-good image tags and rollback commands.
- [ ] Roll out gradually and monitor gateway 5xx, latency, bid conflicts, payment failures, and Kafka consumer lag.
