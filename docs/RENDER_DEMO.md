# BidX demo deployment on Render

This setup runs BidX without Kafka or Elasticsearch. Search reads up to 50 auctions
from Auction Service and filters them in memory. It is intended for a small demo,
not a production-scale marketplace.

## Before deploying

1. In MongoDB Atlas, create one database user and allow network access from
   `0.0.0.0/0`. Use a strong password because Render's outbound IP is not fixed on
   the free tier.
2. Create a Render Key Value instance and copy its **internal Redis URL**.
3. Generate two long random values. Use the same `JWT_ACCESS_SECRET` and
   `JWT_REFRESH_SECRET` in every service that lists them below.
4. Replace every `<...>` placeholder below. Never commit real values to Git.
5. Do not define `PORT`; Render supplies it automatically.

Append the database name to the Atlas URI as shown. For example, the users URI
ends with `/bidx_users?retryWrites=true&w=majority&appName=Cluster0`.

## User Service

```env
NODE_ENV=production
LOG_LEVEL=info
DEMO_MODE=true
MONGODB_URI_USERS=mongodb+srv://<username>:<url-encoded-password>@<cluster>/bidx_users?retryWrites=true&w=majority&appName=Cluster0
REDIS_URL=<render-internal-redis-url>
JWT_ACCESS_SECRET=<same-long-random-access-secret>
JWT_REFRESH_SECRET=<same-long-random-refresh-secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AUTH_REFRESH_COOKIE_NAME=bidx_refresh
AUTH_REFRESH_COOKIE_SECURE=true
AUTH_REFRESH_COOKIE_SAME_SITE=none
AUTH_REFRESH_COOKIE_MAX_AGE_MS=604800000
AUTH_EXPOSE_REFRESH_TOKEN_IN_BODY=false
CORS_ORIGINS=https://<your-vercel-site>.vercel.app
```

## Auction Service

```env
NODE_ENV=production
LOG_LEVEL=info
DEMO_MODE=true
MONGODB_URI_AUCTIONS=mongodb+srv://<username>:<url-encoded-password>@<cluster>/bidx_auctions?retryWrites=true&w=majority&appName=Cluster0
JWT_ACCESS_SECRET=<same-long-random-access-secret>
CORS_ORIGINS=https://<your-vercel-site>.vercel.app
```

## Bidding Service

```env
NODE_ENV=production
LOG_LEVEL=info
DEMO_MODE=true
MONGODB_URI_BIDS=mongodb+srv://<username>:<url-encoded-password>@<cluster>/bidx_bids?retryWrites=true&w=majority&appName=Cluster0
MONGODB_URI_AUCTIONS=mongodb+srv://<username>:<url-encoded-password>@<cluster>/bidx_auctions?retryWrites=true&w=majority&appName=Cluster0
REDIS_URL=<render-internal-redis-url>
JWT_ACCESS_SECRET=<same-long-random-access-secret>
CORS_ORIGINS=https://<your-vercel-site>.vercel.app
```

## Search Service

```env
NODE_ENV=production
LOG_LEVEL=info
DEMO_MODE=true
AUCTION_SERVICE_URL=https://<auction-service>.onrender.com
CORS_ORIGINS=https://<your-vercel-site>.vercel.app
```

Do not add Elasticsearch or Kafka variables in demo mode.

## API Gateway

Use the public `onrender.com` URLs because free Render web services cannot receive
private-network traffic from other services.

```env
NODE_ENV=production
LOG_LEVEL=info
REDIS_URL=<render-internal-redis-url>
JWT_ACCESS_SECRET=<same-long-random-access-secret>
JWT_REFRESH_SECRET=<same-long-random-refresh-secret>
CORS_ORIGINS=https://<your-vercel-site>.vercel.app
USER_SERVICE_URL=https://<user-service>.onrender.com
AUCTION_SERVICE_URL=https://<auction-service>.onrender.com
SEARCH_SERVICE_URL=https://<search-service>.onrender.com
BIDDING_SERVICE_URL=https://<bidding-service>.onrender.com
PAYMENT_SERVICE_URL=https://unused.invalid
NOTIFICATION_SERVICE_URL=https://unused.invalid
ADMIN_SERVICE_URL=https://unused.invalid
```

## Optional services

Payment, Notification, and Admin are not required for the five-service demo. If
you deploy them, set `NODE_ENV=production`, `DEMO_MODE=true`, and their matching
MongoDB URI. Payment can run with its development payment gateway when Razorpay
keys are absent; no real payment will be processed.

## Render settings

Create each backend component as a **Web Service** from the same repository:

| Service | Root directory | Build command | Start command | Health path |
|---|---|---|---|---|
| API Gateway | repository root | `npm install` | `npm run start:gateway` | `/api/v1/health` |
| User | repository root | `npm install` | `npm run start:user` | `/api/v1/health` |
| Auction | repository root | `npm install` | `npm run start:auction` | `/api/v1/health` |
| Search | repository root | `npm install` | `npm run start:search` | `/api/v1/health` |
| Bidding | repository root | `npm install` | `npm run start:bidding` | `/api/v1/health` |

After all service URLs exist, update the API Gateway variables and redeploy it.
Then set this in Vercel and redeploy the frontend:

```env
NEXT_PUBLIC_API_URL=https://<api-gateway>.onrender.com/api/v1
```

Free web services sleep when idle, so the first request after inactivity can take
about a minute. If a health check fails, inspect that service's Render logs first.
