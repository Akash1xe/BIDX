const db = require("../config/db");
const { model: AuditLog } = require("../models/audit-log.model");

class AdminService {
  init() {
    this.audit = AuditLog(db.get("admin"));
    this.users = db.get("users").collection("users");
    this.products = db.get("auctions").collection("products");
    this.auctions = db.get("auctions").collection("auctions");
    this.bids = db.get("bids").collection("bids");
    this.payments = db.get("payments").collection("payments");
  }

  async listUsers({ q, page = 1, limit = 20 }) {
    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ email: rx }, { name: rx }];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.users
        .find(filter, { projection: { password: 0, otpHash: 0 } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.users.countDocuments(filter)
    ]);
    return { items, total, page, limit };
  }

  async setUserSuspended(userId, isSuspended, reason) {
    const result = await this.users.updateOne(
      { _id: new (require("mongodb").ObjectId)(userId) },
      { $set: { isSuspended: Boolean(isSuspended), suspendedReason: reason || null } }
    );
    return { matched: result.matchedCount, modified: result.modifiedCount };
  }

  async listAuctions({ status, page = 1, limit = 20 }) {
    const filter = {};
    if (status) filter.status = status;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.auctions.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      this.auctions.countDocuments(filter)
    ]);
    return { items, total, page, limit };
  }

  async stats() {
    const [users, sellers, suspendedUsers, auctions, liveAuctions, soldAuctions, bids, paymentsCursor] =
      await Promise.all([
        this.users.countDocuments({}),
        this.users.countDocuments({ role: "SELLER" }),
        this.users.countDocuments({ isSuspended: true }),
        this.auctions.countDocuments({}),
        this.auctions.countDocuments({ status: "LIVE" }),
        this.auctions.countDocuments({ status: "SOLD" }),
        this.bids.countDocuments({}),
        this.payments
          .aggregate([
            { $match: { status: "PAID" } },
            { $group: { _id: null, grossMinor: { $sum: "$amountMinor" }, count: { $sum: 1 } } }
          ])
          .toArray()
      ]);
    const paymentsAgg = paymentsCursor[0] || { grossMinor: 0, count: 0 };
    return {
      users,
      sellers,
      suspendedUsers,
      auctions,
      liveAuctions,
      soldAuctions,
      bids,
      paidPayments: paymentsAgg.count,
      gmvMinor: paymentsAgg.grossMinor
    };
  }

  async recordAudit(entry) {
    return this.audit.create(entry);
  }

  async listAudit({ page = 1, limit = 50 }) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.audit.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.audit.countDocuments({})
    ]);
    return { items, total, page, limit };
  }
}

module.exports = new AdminService();
