const { ApiResponse } = require("@bidx/shared");
const searchService = require("../services/search.service");

async function searchAuctions(req, res) {
  const data = await searchService.search(req.query);
  return ApiResponse.success(res, { statusCode: 200, message: "Search results", data });
}

async function suggestAuctions(req, res) {
  const suggestions = await searchService.suggest(req.query.q);
  return ApiResponse.success(res, { statusCode: 200, message: "Suggestions", data: { suggestions } });
}

module.exports = { searchAuctions, suggestAuctions };
