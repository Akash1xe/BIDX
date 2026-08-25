const env = require("./env");

const ROUTES = [
  {
    prefix: "/api/v1/auth",
    service: "user",
    target: env.services.user,
    auth: false
  },
  {
    prefix: "/api/v1/users",
    service: "user",
    target: env.services.user,
    auth: true
  },
  {
    prefix: "/api/v1/products",
    service: "auction",
    target: env.services.auction,
    auth: false
  },
  {
    prefix: "/api/v1/auctions",
    service: "auction",
    target: env.services.auction,
    auth: false
  },
  {
    prefix: "/api/v1/search",
    service: "search",
    target: env.services.search,
    auth: false
  },
  {
    prefix: "/api/v1/bids",
    service: "bidding",
    target: env.services.bidding,
    auth: true
  },
  {
    prefix: "/api/v1/payments/webhook",
    service: "payment",
    target: env.services.payment,
    auth: false
  },
  {
    prefix: "/api/v1/payments",
    service: "payment",
    target: env.services.payment,
    auth: true
  },
  {
    prefix: "/api/v1/notifications",
    service: "notification",
    target: env.services.notification,
    auth: false
  },
  {
    prefix: "/api/v1/admin",
    service: "admin",
    target: env.services.admin,
    auth: true
  }
].sort((a, b) => b.prefix.length - a.prefix.length);

function matchRoute(pathname) {
  return ROUTES.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`));
}

module.exports = { ROUTES, matchRoute };
