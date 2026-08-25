const adminService = require("../services/admin.service");
const asyncHandler = require("../utils/async-handler.util");
const { ApiError } = require("@bidx/shared/errors/api-error");

function parsePaging(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit };
}

exports.listUsers = asyncHandler(async (req, res) => {
  const data = await adminService.listUsers({ ...parsePaging(req.query), q: req.query.q });
  res.json({ success: true, data });
});

exports.suspendUser = asyncHandler(async (req, res) => {
  const isSuspended = Boolean(req.body.isSuspended);
  const result = await adminService.setUserSuspended(req.params.id, isSuspended, req.body.reason);
  if (!result.matched) throw ApiError.notFound("User not found");
  await adminService.recordAudit({
    actorId: req.user.id,
    action: isSuspended ? "USER_SUSPENDED" : "USER_UNSUSPENDED",
    targetType: "user",
    targetId: req.params.id,
    details: { reason: req.body.reason || null }
  });
  res.json({ success: true, data: result });
});

exports.listAuctions = asyncHandler(async (req, res) => {
  const data = await adminService.listAuctions({ ...parsePaging(req.query), status: req.query.status });
  res.json({ success: true, data });
});

exports.stats = asyncHandler(async (_req, res) => {
  const data = await adminService.stats();
  res.json({ success: true, data });
});

exports.listAudit = asyncHandler(async (req, res) => {
  const data = await adminService.listAudit(parsePaging(req.query));
  res.json({ success: true, data });
});
