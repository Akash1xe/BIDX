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

class SearchService {
  constructor(es) {
    this.es = es;
  }
  assertReady() {
    if (!readiness.indexReady) {
      throw ApiError.serviceUnavailable("Search index is not ready yet");
    }
  }

  async search(params) {
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
