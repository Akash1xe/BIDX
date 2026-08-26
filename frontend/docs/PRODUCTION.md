# Production architecture

## Browser boundary

The browser communicates only with the public API Gateway:

```text
Frontend :3000 → API Gateway :4000 → internal services
```

`NEXT_PUBLIC_API_URL` must end in `/api/v1`. `NEXT_PUBLIC_SOCKET_URL` must point
to the same public gateway origin after WebSocket proxy support is added. Never
configure the browser with internal service names or ports 4001–4007.

## Container deployment

The frontend image uses Node 22, a reproducible `npm ci` build, a non-root
runtime user, and an HTTP health check. The full-stack Compose overlay adds all
application services to the existing infrastructure compose file:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.full.yml \
  up --build
```

Before starting, replace both JWT secrets and the Razorpay webhook secret. Live
payment deployments also require Razorpay keys. The browser opens the frontend
at `http://localhost:3000` and reaches only the gateway at
`http://localhost:4000/api/v1`.

The original repository lacked Dockerfiles for the payment, notification, and
admin services. Phase 9 supplies Dockerfiles matching the existing workspace
image pattern.

## Session handling

Access tokens are held in React memory and are never written to browser storage.
On reload, the provider uses the persisted refresh token once to obtain a new
token pair. This narrows access-token exposure, but the backend still requires
the refresh token to be JavaScript-readable. The production target remains a
rotated `Secure`, `HttpOnly`, `SameSite` refresh cookie with CSRF protection.

## Response security

Hosted responses set:

- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- strict referrer and permissions policies;
- CSP restrictions for base URLs, objects, forms, and frame ancestors;
- HSTS on HTTPS requests.

The CSP intentionally does not restrict script or connection origins yet,
because Razorpay Checkout and the separately configured gateway require a
deployment-specific allowlist. Add those directives only after final domains
are known.

## Release gates

Run:

```bash
npm run lint
npm run test:production
npm run build
BIDX_API_URL=https://api.yourdomain.com/api/v1 npm run smoke:api
```

The production unit checks cover token persistence, normalized HTTP failures,
security headers, and Docker gateway boundaries. The smoke command is read-only
and verifies gateway health, auctions, and search.

Complete authenticated buyer, seller, and admin flows using the checklist in
`RELEASE_CHECKLIST.md` against a test environment with seeded role accounts.
