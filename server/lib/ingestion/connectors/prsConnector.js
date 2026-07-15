const {
  SOURCE_DEFINITIONS,
  crawlDefinition,
  parseBillDetail,
  requestPage,
} = require("../../prsCatalog");
const { sha256 } = require("../core/hashing");
const { attachConnectorLifecycle } = require("./connectorLifecycle");

const enrichBill = async (document, options) => {
  if (
    options.catalogOnly ||
    document.documentType !== "bill" ||
    document.jurisdictionLevel !== "parliament" ||
    !document.detailUrl
  ) {
    return document;
  }
  const html = await requestPage(document.detailUrl, options);
  const detail = parseBillDetail(html, document.detailUrl);
  return {
    ...document,
    title: detail.title || document.title,
    year: detail.year || document.year,
    status: document.status || detail.status,
    ministry: detail.ministry || document.ministry,
    category: detail.category || document.category,
    pdfUrl: detail.pdfUrl || document.pdfUrl,
    htmlHash: sha256(html),
    resources: detail.resources,
    metadata: {
      ...(document.sourceMetadata || {}),
      detail: detail.metadata,
    },
  };
};

const selectedDefinitions = (options = {}) => {
  const requested = options.collection || options.collections;
  const selected = requested
    ? String(requested)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : SOURCE_DEFINITIONS.map((definition) => definition.key);
  if (selected.includes("all")) {
    return SOURCE_DEFINITIONS;
  }
  return SOURCE_DEFINITIONS.filter((definition) =>
    selected.includes(definition.key),
  );
};

const prsConnector = {
  name: "prs-india",
  defaultCollection: "all",

  async collect(options = {}) {
    const definitions = selectedDefinitions(options);
    if (!definitions.length) {
      throw new Error(
        `Unknown PRS collection: ${
          options.collection || options.collections || "(empty)"
        }`,
      );
    }

    const records = [];
    const snapshots = [];
    const errors = [];
    const diagnostics = [];
    for (const definition of definitions) {
      try {
        const result = await crawlDefinition(definition, options);
        const limit = Number(options.limit || result.documents.length);
        for (const document of result.documents.slice(0, limit)) {
          try {
            records.push(await enrichBill(document, options));
          } catch (error) {
            records.push(document);
            errors.push({
              stage: "detail",
              sourceRecordId: document.sourceDocumentId,
              message: error.message,
            });
          }
        }
        snapshots.push(
          ...result.snapshots.map((snapshot) => ({
            ...snapshot,
            htmlHash: snapshot.contentSha256,
            responseStatus: 200,
            collectedAt: new Date().toISOString(),
          })),
        );
        if (result.truncated) {
          diagnostics.push({
            type: "page-limit-reached",
            collection: definition.key,
            pagesFetched: result.pagesFetched,
            nextPageUrl: result.nextPageUrl,
          });
        }
      } catch (error) {
        errors.push({
          stage: "collection",
          collection: definition.key,
          code: "PRS_COLLECTION_FAILED",
          message: error.message,
        });
      }
    }
    return { records, snapshots, errors, diagnostics };
  },
};

attachConnectorLifecycle(
  prsConnector,
  SOURCE_DEFINITIONS.map((definition) => definition.key),
);

module.exports = {
  prsConnector,
  selectedDefinitions,
};
