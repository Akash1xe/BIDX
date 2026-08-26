export function formatPaymentAmount(payment) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: payment?.currency || "INR",
    maximumFractionDigits: 2,
  }).format(Number(payment?.amountMinor || 0) / 100);
}

export function paymentRole(payment, userId) {
  if (String(payment?.winnerId) === String(userId)) return "WINNER";
  if (String(payment?.sellerId) === String(userId)) return "SELLER";
  return "PARTICIPANT";
}
