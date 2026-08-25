const Handlebars = require("handlebars");
const path = require("path");
const fs = require("fs");

const TEMPLATES_DIR = path.join(__dirname, "../../templates");

const templateCache = new Map();

function loadTemplate(name) {
  if (templateCache.has(name)) return templateCache.get(name);
  const filePath = path.join(TEMPLATES_DIR, `${name}.hbs`);
  if (!fs.existsSync(filePath)) return null;
  const source = fs.readFileSync(filePath, "utf8");
  const compiled = Handlebars.compile(source);
  templateCache.set(name, compiled);
  return compiled;
}

function render(templateName, data) {
  const normalized = templateName.toLowerCase().replace(/_/g, "-");
  const template = loadTemplate(normalized);
  if (!template) return null;
  return template(data);
}

const SUBJECT_MAP = {
  OUTBID: "You've been outbid!",
  WINNER: "Congratulations! You won the auction",
  SELLER_SOLD: "Your item has been sold",
  WINNER_FALLBACK: "You're now the highest bidder",
  SALE_LOST: "You lost the auction",
  AUCTION_SOLD: "Your auction has been sold",
  AUCTION_UNSOLD: "Your auction ended without a sale",
  PAYMENT_SUCCESS: "Payment received",
  PAYMENT_RECEIPT: "Your payment receipt"
};

function getSubject(type, data) {
  const base = SUBJECT_MAP[type] || "BidX notification";
  if (data?.auctionId) return `${base} - ${data.auctionId.slice(-6)}`;
  return base;
}

module.exports = { render, getSubject, loadTemplate };
