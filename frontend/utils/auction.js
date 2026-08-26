export function getAuctionId(auction) {
  return auction?.id || auction?.auctionId || auction?._id || "";
}

export function getProduct(auction) {
  if (auction?.product) return auction.product;
  return {
    name: auction?.name,
    description: auction?.description,
    images: auction?.images,
    category: auction?.category,
    condition: auction?.condition,
  };
}

export function getCurrentPrice(auction) {
  return Number(auction?.currentBid || auction?.currentPrice || auction?.startingPrice || 0);
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatCondition(value = "") {
  return value.toLowerCase().replaceAll("_", " ");
}

export function getPagination(data, fallbackPage = 1) {
  const pagination = data?.pagination || {};
  const page = Number(pagination.page || pagination.currentPage || fallbackPage);
  const totalPages = Number(
    pagination.totalPages ||
    pagination.pages ||
    Math.ceil(Number(pagination.total || 0) / Number(pagination.limit || 20)) ||
    1
  );

  return { page, totalPages: Math.max(1, totalPages), total: Number(pagination.total || 0) };
}

