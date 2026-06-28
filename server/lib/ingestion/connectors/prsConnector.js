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

const prsConnector = {
  name: "prs-india",
  defaultCollection: "parliament-bills",

  async collect(options = {}) {
    const selected = String(
      options.collection || options.collections || this.defaultCollection,
    )
      .split(",")
      .map((value) => value.trim());
    const definitions = SOURCE_DEFINITIONS.filter((definition) =>
      selected.includes(definition.key),
    );
    if (!definitions.length) {
      throw new Error(`Unknown PRS collection: ${selected.join(", ")}`);
    }

    const records = [];
    const snapshots = [];
    const errors = [];
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
      } catch (error) {
        errors.push({
          stage: "collection",
          collection: definition.key,
          message: error.message,
        });
      }
    }
    return { records, snapshots, errors };
  },
};

attachConnectorLifecycle(
  prsConnector,
  SOURCE_DEFINITIONS.map((definition) => definition.key),
);

module.exports = {
  prsConnector,
};
