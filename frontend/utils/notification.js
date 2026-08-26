export function notificationId(notification) {
  return String(notification?._id || notification?.id || notification?.eventId || "");
}

export function notificationSubject(notification) {
  return notification?.subject || String(notification?.type || "BidX notification").replaceAll("_", " ");
}

export function notificationHref(notification) {
  if (notification?.auctionId) return `/auctions/${notification.auctionId}`;
  return "/dashboard/notifications";
}
