const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  type: { type: String, required: true },
  userId: { type: String, required: true },
  auctionId: { type: String },
  subject: { type: String },
  status: { type: String, enum: ["SENT", "FAILED", "SKIPPED"], default: "SENT" },
  provider: { type: String },
  providerMessageId: { type: String },
  error: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  sentAt: { type: Date, default: Date.now }
});

notificationSchema.index({ userId: 1, sentAt: -1 });
notificationSchema.index({ auctionId: 1 });
notificationSchema.index({ eventId: 1 }, { unique: true });

function model(connection) {
  return (
    connection.models.Notification ||
    connection.model("Notification", notificationSchema)
  );
}

module.exports = { model, notificationSchema };
