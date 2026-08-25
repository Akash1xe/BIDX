const mongoose = require("mongoose");

const AUCTION_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  ENDED: "ENDED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  SOLD: "SOLD",
  UNSOLD: "UNSOLD"
});

const TRANSITIONS = Object.freeze({
  DRAFT: [AUCTION_STATUS.SCHEDULED, AUCTION_STATUS.LIVE],
  SCHEDULED: [AUCTION_STATUS.LIVE, AUCTION_STATUS.DRAFT],
  LIVE: [AUCTION_STATUS.ENDED],
  ENDED: [AUCTION_STATUS.PAYMENT_PENDING, AUCTION_STATUS.SOLD, AUCTION_STATUS.UNSOLD],
  PAYMENT_PENDING: [AUCTION_STATUS.SOLD, AUCTION_STATUS.ENDED],
  SOLD: [],
  UNSOLD: []
});

const auctionSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    product: {
      name: String,
      description: String,
      images: [String],
      category: String,
      condition: String
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    startingPrice: {
      type: Number,
      required: true,
      min: 1
    },
    currentBid: {
      type: Number,
      default: 0
    },
    highestBidderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    minimumIncrement: {
      type: Number,
      required: true,
      min: 1
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    startedAt: {
      type: Date,
      default: null
    },
    endedAt: {
      type: Date,
      default: null
    },
    winningBidderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    finalPrice: {
      type: Number,
      default: 0
    },
    soldAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: Object.values(AUCTION_STATUS),
      default: AUCTION_STATUS.DRAFT,
      index: true
    },
    version: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

auctionSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    product: this.product,
    sellerId: this.sellerId.toString(),
    startingPrice: this.startingPrice,
    currentBid: this.currentBid,
    highestBidderId: this.highestBidderId ? this.highestBidderId.toString() : null,
    minimumIncrement: this.minimumIncrement,
    startTime: this.startTime,
    endTime: this.endTime,
    startedAt: this.startedAt,
    endedAt: this.endedAt,
    winningBidderId: this.winningBidderId ? this.winningBidderId.toString() : null,
    finalPrice: this.finalPrice,
    status: this.status
  };
};

module.exports = mongoose.model("Auction", auctionSchema);
module.exports.AUCTION_STATUS = AUCTION_STATUS;
module.exports.TRANSITIONS = TRANSITIONS;
