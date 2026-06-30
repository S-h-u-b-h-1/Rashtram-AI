const DocumentRepository = require("./DocumentRepository");
const { searchAcrossIndexedDocuments } = require("./documentResearchService");

const filterCache = new Map();
const FILTER_CACHE_TTL_MS = 5 * 60 * 1_000;

const withSemanticIds = async (options) => {
  if (
    options.semantic !== true &&
    options.semantic !== "true"
  ) {
    return options;
  }
  const query = String(options.search || options.q || "").trim();
  if (query.length < 3) return options;
  try {
    return {
      ...options,
      semanticIds: await searchAcrossIndexedDocuments(query, 40),
    };
  } catch (error) {
    console.warn(
      "Semantic document search unavailable; using catalogue search:",
      error.message,
    );
    return options;
  }
};

const find = async (options) =>
  DocumentRepository.find(await withSemanticIds(options));

const search = async (options) =>
  DocumentRepository.search(await withSemanticIds(options));

const getFilterOptions = async (options = {}) => {
  const key = JSON.stringify({
    type: options.type || null,
    scope: options.scope || null,
    jurisdictionLevel: options.jurisdictionLevel || null,
  });
  const cached = filterCache.get(key);
  if (cached && Date.now() - cached.cachedAt < FILTER_CACHE_TTL_MS) {
    return cached.value;
  }
  const value = await DocumentRepository.getFilterOptions(options);
  filterCache.set(key, { cachedAt: Date.now(), value });
  if (filterCache.size > 50) {
    const oldest = [...filterCache.entries()].sort(
      (left, right) => left[1].cachedAt - right[1].cachedAt,
    )[0]?.[0];
    if (oldest) filterCache.delete(oldest);
  }
  return value;
};

const getById = async (id, userId = null) => {
  const document = await DocumentRepository.getById(id);
  if (!document) return null;
  const [resources, relationships, recommendations, relatedChats, summary] =
    await Promise.all([
      DocumentRepository.getResources(document.id),
      DocumentRepository.getRelated(document.id),
      DocumentRepository.getRecommendations(document.id, userId),
      DocumentRepository.getRelatedChats(document.id, userId),
      DocumentRepository.getSummary(document.id, userId),
    ]);
  const [timeline, graph] = await Promise.all([
    DocumentRepository.getTimeline(
      document.id,
      document,
      relationships,
    ),
    DocumentRepository.getGraph(
      document.id,
      document,
      relationships,
    ),
  ]);
  return {
    ...document,
    summary,
    resources,
    relationships,
    recommendations,
    relatedChats,
    timeline,
    graph,
  };
};

module.exports = {
  ...DocumentRepository,
  find,
  getFilterOptions,
  getById,
  search,
};
