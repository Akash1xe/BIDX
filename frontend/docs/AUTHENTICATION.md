# BidX frontend authentication

## Implemented flow

```text
Signup details
      ↓ POST /auth/send-otp
OTP page
      ↓ POST /auth/verify-otp
Verified signup
      ↓ POST /auth/signup
Shared authenticated session
```

Login calls `POST /auth/login` and commits the returned user and token pair to
the same session source.

## Runtime architecture

```text
Page / feature
      ↓ useAuth()
AuthProvider
      ↓ features/auth/api.js
Central API client
      ↓ API Gateway
BidX User Service
```

`AuthProvider` owns the current user, token pair, signup draft, refresh, and
logout. The signup password is held only in provider memory while the OTP flow
is active; refreshing the OTP page intentionally requires restarting signup.

The Axios request interceptor asks `authBridge` for the current access token.
When concurrent requests receive `401`, they share one refresh promise. The
rotated token pair replaces the old pair before failed requests are retried.
Refresh failure clears the session.

## Route roles

| Route | Frontend roles | Backend authority |
| --- | --- | --- |
| `/dashboard` | USER, SELLER, ADMIN | Each requested resource verifies its user |
| `/seller` | SELLER, ADMIN | Product and auction services verify role and ownership |
| `/admin` | ADMIN | Admin service verifies ADMIN |

Frontend guards are navigation and UX controls only. They are not security
boundaries; the gateway and services remain authoritative.

## Session policy

The current backend returns refresh tokens in JSON and requires them in the
refresh body. The frontend therefore encapsulates browser persistence in
`features/auth/storage.js`. See `CONTRACT_GAPS.md` for the recommended HttpOnly
cookie migration before a public production launch.

