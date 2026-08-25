const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  actorId: { type: String, required: true },
  action: { type: String, required: true },
  targetType: { type: String },
  targetId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

function model(connection) {
  return connection.models.AuditLog || connection.model("AuditLog", auditLogSchema);
}

module.exports = { model, auditLogSchema };
