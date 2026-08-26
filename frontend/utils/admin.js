export function adminId(record) {
  return String(record?.id || record?._id || "");
}

export function adminPagination(data, fallbackPage = 1) {
  const page = Number(data?.page || fallbackPage);
  const limit = Number(data?.limit || 20);
  const total = Number(data?.total || 0);
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function shortId(value) {
  const id = String(value || "");
  return id ? `•••${id.slice(-6)}` : "Unavailable";
}
