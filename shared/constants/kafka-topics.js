const KAFKA_TOPICS = Object.freeze({
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",

  AUCTION_CREATED: "auction.created",
  AUCTION_UPDATED: "auction.updated",
  AUCTION_STARTED: "auction.started",
  AUCTION_ENDED: "auction.ended",
  AUCTION_DELETED: "auction.deleted",

  BID_PLACED: "bid.placed",
  BID_ACCEPTED: "bid.accepted",
  BID_REJECTED: "bid.rejected",

  WINNER_SELECTED: "winner.selected",
  AUCTION_SOLD: "auction.sold",
  AUCTION_UNSOLD: "auction.unsold",

  PAYMENT_CREATED: "payment.created",
  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",

  NOTIFICATION_EMAIL: "notification.email"
});

module.exports = { KAFKA_TOPICS };
