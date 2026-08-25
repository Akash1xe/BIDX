const mongoose = require("mongoose");
const db = require("../config/db");

const AUCTION_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  ENDED: "ENDED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  SOLD: "SOLD",
  UNSOLD: "UNSOLD"
});

// Read model mirror of auction-service's collection. bidding-service only
// reads + OCC-writes currentBid/highestBidderId/version.
const auctionSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    startingPrice: { type: Number, required: true },
    minimumIncrement: { type: Number, required: true },
    currentBid: { type: Number, default: 0 },
    highestBidderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    endTime: { type: Date, required: true },
    status: { type: String, required: true }
  },
  {
    timestamps: true,
    versionKey: "version",
    optimisticConcurrency: false
  }
);

function getModel() {
  return db.get("auctions").model("Auction", auctionSchema, "auctions");
}

module.exports = { getModel, AUCTION_STATUS };
