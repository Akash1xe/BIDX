const { ApiError } = require("@bidx/shared");
const env = require("../config/env");
const readiness = require("../config/readiness");
const esClient = require("../config/elasticsearch");

const SORTS = {
  relevance: [{ _score: "desc" }, { endTime: "asc" }],
  price_asc: [{ startingPrice: "asc" }],
  price_desc: [{ startingPrice: "desc" }],
  ending_soon: [{ endTime: "asc" }],
  newest: [{ startTime: "desc" }]
};

function parseStatuses(raw) {
  if (!raw) return null;
  const statuses = String(raw)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  // DRAFT auctions are never publicly searchable
  return statuses.filter((s) => s !== "DRAFT");
}

function demoPrice(auction) {
  return Number(auction.currentBid || auction.currentPrice || auction.startingPrice || 0);
}

function demoProduct(auction) {
  return auction.product || auction;
}

function countFacet(items, readValue) {
  const counts = new Map();
  for (const item of items) {
    const value = readValue(item);
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

class SearchService {
  constructor(es) {
    this.es = es;
  }
  assertReady() {
    if (!readiness.indexReady) {
      throw ApiError.serviceUnavailable("Search index is not ready yet");
    }
  }

  async fetchDemoAuctions() {
    const baseUrl = env.auctionServiceUrl.replace(/\/api\/v1\/?$/, "");
    let response;
    try {
      response = await fetch(`${baseUrl}/api/v1/auctions?page=1&limit=50`);
    } catch (error) {
      throw ApiError.serviceUnavailable(`Auction Service is unavailable: ${error.message}`);
    }
    if (!response.ok) {
      throw ApiError.serviceUnavailable(`Auction Service returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    return Array.isArray(payload?.data?.items) ? payload.data.items : [];
  }

  async searchDemo(params) {
    const page = Math.max(1, parseInt(params.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(params.limit || "20", 10)));
    const q = String(params.q || "").trim().toLowerCase();
    const statuses = parseStatuses(params.status);
    const minPrice = params.minPrice === undefined || params.minPrice === "" ? null : Number(params.minPrice);
    const maxPrice = params.maxPrice === undefined || params.maxPrice === "" ? null : Number(params.maxPrice);
    if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
      throw ApiError.badRequest("minPrice/maxPrice must be numbers");
    }

    let results = (await this.fetchDemoAuctions()).filter((auction) => {
      const product = demoProduct(auction);
      const text = `${product.name || ""} ${product.description || ""}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (statuses?.length && !statuses.includes(auction.status)) return false;
      if (!statuses?.length && auction.status === "DRAFT") return false;
      if (params.category && String(product.category || "").toLowerCase() !== String(params.category).toLowerCase()) return false;
      if (params.condition && product.condition !== params.condition) return false;
      if (params.sellerId && String(auction.sellerId) !== String(params.sellerId)) return false;
      const price = demoPrice(auction);
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;
      return true;
    });

    const sortKey = params.sort && SORTS[params.sort] ? params.sort : q ? "relevance" : "newest";
    if (sortKey === "price_asc") results.sort((a, b) => demoPrice(a) - demoPrice(b));
    if (sortKey === "price_desc") results.sort((a, b) => demoPrice(b) - demoPrice(a));
    if (sortKey === "ending_soon") results.sort((a, b) => new Date(a.endTime) - new Date(b.endTime));
    if (sortKey === "newest") results.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    const total = results.length;
    const from = (page - 1) * limit;
    const pageResults = results.slice(from, from + limit);
    return {
      results: pageResults,
      facets: {
        categories: countFacet(results, (auction) => demoProduct(auction).category),
        statuses: countFacet(results, (auction) => auction.status)
      },
      pagination: { page, limit, total },
      sort: sortKey,
      mode: "demo"
    };
  }

  async search(params) {
    if (env.demoMode) return this.searchDemo(params);
    this.assertReady();

    const page = Math.max(1, parseInt(params.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(params.limit || "20", 10)));
    const from = (page - 1) * limit;

    const sortKey = params.sort && SORTS[params.sort] ? params.sort : params.q ? "relevance" : "newest";

    const must = [];
    const filter = [];
    const mustNot = [];

    const q = (params.q || "").trim();
    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ["name^3", "description"],
          fuzziness: "AUTO",
          operator: "AND"
        }
      });
    }

    const statuses = parseStatuses(params.status);
    if (statuses && statuses.length > 0) {
      filter.push({ terms: { status: statuses } });
    } else {
      mustNot.push({ term: { status: "DRAFT" } });
    }

    if (params.category) filter.push({ term: { category: String(params.category).toLowerCase() } });
    if (params.condition) filter.push({ term: { condition: params.condition } });
    if (params.sellerId) filter.push({ term: { sellerId: params.sellerId } });

    const range = {};
    if (params.minPrice !== undefined && params.minPrice !== "") range.gte = Number(params.minPrice);
    if (params.maxPrice !== undefined && params.maxPrice !== "") range.lte = Number(params.maxPrice);
    if (Object.keys(range).length > 0) {
      if (Number.isNaN(range.gte) || Number.isNaN(range.lte)) {
        throw ApiError.badRequest("minPrice/maxPrice must be numbers");
      }
      filter.push({ range: { startingPrice: range } });
    }

    const body = {
      query: {
        bool: {
          ...(must.length ? { must } : {}),
          ...(filter.length ? { filter } : {}),
          ...(mustNot.length ? { must_not: mustNot } : {})
        }
      },
      aggs: {
        categories: { terms: { field: "category", size: 20 } },
        statuses: { terms: { field: "status", size: 10 } }
      }
    };

    let response;
    try {
      response = await this.es.search({
        index: env.elasticsearch.auctionsIndex,
        from,
        size: limit,
        track_total_hits: true,
        body,
        ...(sortKey === "relevance" && !q ? {} : { sort: SORTS[sortKey] })
      });
    } catch (err) {
      if (err.meta && err.meta.statusCode === 400) {
        throw ApiError.badRequest(`Invalid search query: ${err.message}`);
      }
      throw err;
    }

    return {
      results: response.hits.hits.map((hit) => ({ score: hit._score, ...hit._source })),
      facets: {
        categories: response.aggregations.categories.buckets.map((b) => ({ value: b.key, count: b.doc_count })),
        statuses: response.aggregations.statuses.buckets.map((b) => ({ value: b.key, count: b.doc_count }))
      },
      pagination: {
        page,
        limit,
        total: typeof response.hits.total === "number" ? response.hits.total : response.hits.total.value
      },
      sort: sortKey
    };
  }

  async suggest(query) {
    if (env.demoMode) {
      const q = String(query || "").trim().toLowerCase();
      if (!q) return [];
      const auctions = await this.fetchDemoAuctions();
      return auctions
        .filter((auction) => auction.status !== "DRAFT" && String(demoProduct(auction).name || "").toLowerCase().includes(q))
        .slice(0, 8)
        .map((auction) => ({
          auctionId: auction.id || auction.auctionId,
          name: demoProduct(auction).name,
          category: demoProduct(auction).category
        }));
    }
    this.assertReady();

    const q = (query || "").trim();
    if (!q) {
      return [];
    }

    const response = await this.es.search({
      index: env.elasticsearch.auctionsIndex,
      size: 8,
      _source: ["auctionId", "name", "category"],
      body: {
        query: {
          bool: {
            must: [{ match_phrase_prefix: { name: q } }],
            must_not: [{ term: { status: "DRAFT" } }]
          }
        }
      }
    });

    return response.hits.hits.map((hit) => hit._source);
  }
}

module.exports = new SearchService(esClient.inner);
