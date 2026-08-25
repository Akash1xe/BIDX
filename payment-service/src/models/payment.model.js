const mongoose = require("mongoose");

const PAYMENT_STATUS = Object.freeze({
  CREATED: "CREATED",
  PAID: "PAID",
  FAILED: "FAILED"
});

const paymentSchema = (connection) => {
  const schema = new mongoose.Schema(
    {
      auctionId: {
        type: String,
        required: true,
        index: true
      },
      winnerId: {
        type: String,
        required: true,
        index: true
      },
      sellerId: {
        type: String,
        required: true
      },
      amountMinor: {
        type: Number,
        required: true,
        min: 100
      },
      currency: {
        type: String,
        default: "INR"
      },
      orderId: {
        type: String,
        required: true,
        unique: true
      },
      paymentId: {
        type: String,
        default: null
      },
      status: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        default: PAYMENT_STATUS.CREATED,
        index: true
      },
      providerEventIds: {
        type: [String],
        default: []
      },
      mode: {
        type: String,
        enum: ["live", "dev"],
        required: true
      }
    },
    { timestamps: true }
  );

  schema.index({ auctionId: 1, status: 1 });

  schema.methods.toPublic = function toPublic() {
    return {
      id: this._id.toString(),
      auctionId: this.auctionId,
      winnerId: this.winnerId,
      sellerId: this.sellerId,
      amountMinor: this.amountMinor,
      currency: this.currency,
      orderId: this.orderId,
      paymentId: this.paymentId,
      status: this.status,
      mode: this.mode,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  };

  return connection.models.Payment || connection.model("Payment", schema);
};

module.exports = { PAYMENT_STATUS, paymentSchema };
