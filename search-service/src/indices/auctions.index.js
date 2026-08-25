const env = require("../config/env");

const AUCTIONS_MAPPING = {
  properties: {
    auctionId: { type: "keyword" },
    productId: { type: "keyword" },
    sellerId: { type: "keyword" },
    name: {
      type: "text",
      fields: { keyword: { type: "keyword" } }
    },
    description: { type: "text" },
    images: { type: "keyword" },
    category: { type: "keyword" },
    condition: { type: "keyword" },
    startingPrice: { type: "double" },
    minimumIncrement: { type: "double" },
    currentPrice: { type: "double" },
    bidCount: { type: "integer" },
    status: { type: "keyword" },
    startTime: { type: "date" },
    endTime: { type: "date" },
    startedAt: { type: "date" },
    endedAt: { type: "date" },
    winningBidderId: { type: "keyword" },
    indexedAt: { type: "date" }
  }
};

async function ensureAuctionsIndex(es) {
  const index = env.elasticsearch.auctionsIndex;
  const exists = await es.indices.exists({ index });
  if (!exists) {
    await es.indices.create({
      index,
      mappings: AUCTIONS_MAPPING
    });
    return { created: true };
  }
  await es.indices.putMapping({
    index,
    ...AUCTIONS_MAPPING
  });
  return { created: false };
}

module.exports = { AUCTIONS_MAPPING, ensureAuctionsIndex };
