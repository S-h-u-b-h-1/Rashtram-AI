const cheerio = require("cheerio");
const { absoluteUrl } = require("../core/pdfDiscovery");
const { sha256 } = require("../core/hashing");
const { createSnapshot } = require("../core/sourceSnapshots");
const { attachConnectorLifecycle } = require("./connectorLifecycle");

const DIRECTORY_PAGES = [
  {
    url: "https://igod.gov.in/ug/E002/organizations",
    entityType: "ministry",
    parentName: "Union Government",
  },
  {
    url: "https://igod.gov.in/ug/E003/organizations",
    entityType: "department",
    parentName: "Union Government",
  },
];

const normalize = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\bDetails\b/gi, " ")
    .trim();

const parseGovernmentDirectory = (html, pageUrl, definition) => {
  const $ = cheerio.load(html);
  const entries = [];
  const seen = new Set();
  $("a[href*='/organization/']").each((_, element) => {
    const anchor = $(element);
    const directoryUrl = absoluteUrl(anchor.attr("href"), pageUrl);
    if (!directoryUrl || seen.has(directoryUrl)) return;
    const container = anchor.closest(
      "article, li, tr, .search-row, .views-row, .card, .item, .col-md-4, .col-lg-4",
    );
    if (!container.length || /\/organization\/new_additions\/?$/i.test(directoryUrl)) {
      return;
    }
    const rawAnchorText = String(anchor.text() || "").trim();
    const anchorText = normalize(rawAnchorText);
    const name = !anchorText || /^(details?|view|more)$/i.test(rawAnchorText)
      ? normalize(
          container
            .find("h1, h2, h3, h4, h5, .search-title, .title, strong")
            .first()
            .text() || container.text(),
        )
      : anchorText;
    if (!name || name.length < 4) return;
    const officialUrl = absoluteUrl(
      container.find("a.search-title[href]").first().attr("href"),
      pageUrl,
    );
    seen.add(directoryUrl);
    entries.push({
      sourceName: "ministry",
      entryKey: sha256(directoryUrl).slice(0, 40),
      entityType: definition.entityType,
      name,
      jurisdiction: "India",
      parentName: definition.parentName,
      officialUrl:
        officialUrl && !officialUrl.includes("igod.gov.in/organization/")
          ? officialUrl
          : null,
      directoryUrl,
      metadata: {
        directorySource: "Integrated Government Online Directory",
      },
    });
  });
  return entries;
};

const directoryResultCount = (html) => {
  const match = String(html || "").match(/(\d+)\s+Results\b/i);
  return match ? Number(match[1]) : null;
};

const ministryConnector = {
  name: "ministry",
  defaultCollection: "ministries-and-departments",
  async collect(options = {}, { fetcher }) {
    const combined = {
      records: [],
      directoryEntries: [],
      snapshots: [],
      errors: [],
      diagnostics: [],
    };
    const maximumPages = Math.max(1, Number(options.maxPages || 10));
    for (const definition of DIRECTORY_PAGES) {
      try {
        const response = await fetcher.getText(definition.url);
        const entries = parseGovernmentDirectory(
          response.body,
          definition.url,
          definition,
        );
        const targetCount = directoryResultCount(response.body) || entries.length;
        combined.snapshots.push(
          createSnapshot({
            sourceName: this.name,
            sourceUrl: definition.url,
            body: response.body,
            responseStatus: response.status,
            recordCount: entries.length,
            metadata: {
              collection: this.defaultCollection,
              entityType: definition.entityType,
            },
          }),
        );
        for (
          let page = 1;
          page < maximumPages && entries.length < targetCount;
          page += 1
        ) {
          const batchSize = Math.min(5, targetCount - entries.length);
          const pageUrl =
            `${definition.url}_list_more/${entries.length}/${batchSize}`;
          const pageResponse = await fetcher.getText(pageUrl, {
            headers: { "X-Requested-With": "XMLHttpRequest" },
          });
          const pageEntries = parseGovernmentDirectory(
            pageResponse.body,
            pageUrl,
            definition,
          );
          const known = new Set(entries.map((entry) => entry.directoryUrl));
          const additions = pageEntries.filter(
            (entry) => !known.has(entry.directoryUrl),
          );
          entries.push(...additions);
          combined.snapshots.push(
            createSnapshot({
              sourceName: this.name,
              sourceUrl: pageUrl,
              body: pageResponse.body,
              responseStatus: pageResponse.status,
              recordCount: additions.length,
              metadata: {
                collection: this.defaultCollection,
                entityType: definition.entityType,
                page,
              },
            }),
          );
          if (!additions.length) break;
        }
        combined.directoryEntries.push(...entries);
      } catch (error) {
        combined.errors.push({
          stage: "directory",
          entityType: definition.entityType,
          message: error.message,
        });
      }
    }
    const limit = Math.max(1, Number(options.limit || 200));
    combined.directoryEntries = combined.directoryEntries.slice(0, limit);
    if (!combined.directoryEntries.length) {
      combined.diagnostics.push({
        type: combined.errors.length ? "error" : "empty-source",
        collection: this.defaultCollection,
        message:
          "The official IGOD ministry directory exposed no crawlable organization entries.",
      });
    }
    return combined;
  },
};

attachConnectorLifecycle(ministryConnector, [
  "ministries",
  "departments",
]);

module.exports = {
  DIRECTORY_PAGES,
  directoryResultCount,
  ministryConnector,
  parseGovernmentDirectory,
};
