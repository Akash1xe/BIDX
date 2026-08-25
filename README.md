# BidX — Distributed Real-Time Digital Auction Platform

Microservices-based auction platform built with **Node.js, Express, MongoDB (Mongoose), Redis, Kafka, Elasticsearch, Socket.IO, Razorpay and Docker**.

## Monorepo layout

```text
bidx/
├── api-gateway/          :4000  (Part 3)
├── user-service/         :4001  authentication + profiles
├── auction-service/      :4002  products + auctions (Part 4)
├── search-service/       :4003  Elasticsearch (Part 5)
├── bidding-service/      :4004  bids + concurrency (Part 6)
├── payment-service/      :4005  Razorpay saga (Part 9)
├── notification-service/ :4006  SendGrid emails (Part 11)
├── admin-service/        :4007  moderation (Part 12)
├── shared/                      logger, errors, constants
├── docker-compose.yml
└── package.json                 npm workspaces root
```

## Prerequisites

- Node.js >= 18
- Docker Desktop
- npm >= 9

## Quickstart (Part 1)

```bash
cp .env.example .env
npm install
npm run infra:up        # MongoDB :27017, Redis :6379, Kafka :9092, Kafka UI :8080
npm run dev:user        # user-service on :4001
npm run dev:gateway     # api-gateway on :4000
```

Health checks:

```bash
curl http://localhost:4001/health         # direct service
curl http://localhost:4000/api/v1/auth/send-otp -X POST   # via gateway
```

`npm run infra:up` starts the infrastructure stack via Docker Compose.

## Build roadmap

| Part | Scope | Status |
| ---- | ----- | ------ |
| 1 | Foundation: repo scaffold, user microservice, MongoDB singleton, docker-compose | done |
| 2 | Authentication: OTP signup, login, refresh-token rotation, Google OAuth, Kafka OTP emails, Redis caching/rate-limiting | done |
| 3 | API Gateway: JWT validation, routing, rate limiting, circuit breaker | done |
| 4 | Auction Service: products, auction lifecycle, Kafka events | done |
| 5 | Search Service: Elasticsearch indexing + querying | done |
| 6 | Bidding: Socket.IO real-time, Redis distributed lock, idempotency, OCC | done |
| 7 | Kafka deep-dive: bid events, retry, DLQ | done |
| 8 | Auction completion: winner selection, auto-expiration, outbid notifications | done |
| 9 | Payment: Razorpay adapter, webhooks | done |
| 10 | Saga: winner payment flow, next-bidder fallback | done |
| 11 | Notification Service: Kafka + SendGrid templates | done |
| 12 | Admin Service: moderation, user management | done |
| 13 | Production: structured logging, circuit breakers, E2E testing | done |

## Services & ports

| Service | Port |
| ------- | ---- |
| API Gateway | 4000 |
| User Service | 4001 |
| Auction Service | 4002 |
| Search Service | 4003 |
| Bidding Service | 4004 |
| Payment Service | 4005 |
| Notification Service | 4006 |
| Admin Service | 4007 |
| MongoDB | 27017 |
| Redis | 6379 |
