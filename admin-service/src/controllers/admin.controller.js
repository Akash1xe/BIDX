const adminService = require("../services/admin.service");
const asyncHandler = require("../utils/async-handler.util");
const { ApiError } = require("@bidx/shared/errors/api-error");

function parsePaging(query) {
  return {
    page: Math.max(1, Number(query.page) || 1),
    limit: Math.min(100, Math.max(1, Number(query.limit) || 20))
  };
}

exports.listUsers = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await adminService.listUsers({ ...parsePaging(req.query), q: req.query.q }) });
});

exports.suspendUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw ApiError.conflict("Administrators cannot suspend their own account");
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
  res.json({ success: true, data: await adminService.listAuctions({ ...parsePaging(req.query), status: req.query.status }) });
});

exports.stats = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await adminService.stats() });
});

exports.listAudit = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await adminService.listAudit(parsePaging(req.query)) });
});
