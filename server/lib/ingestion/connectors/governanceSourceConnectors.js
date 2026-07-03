const cheerio = require("cheerio");
const { absoluteUrl, discoverPdfLinks } = require("../core/pdfDiscovery");
const { sha256 } = require("../core/hashing");
const { createSnapshot } = require("../core/sourceSnapshots");
const { attachConnectorLifecycle } = require("./connectorLifecycle");
const {
  createPublicListingConnector,
  dateFromText,
} = require("./publicListingConnector");

const text = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const pibType = (value) => {
  const title = String(value || "").toLowerCase();
  if (/\b(cabinet|ccea|ccpa|ccs)\b/.test(title)) return "cabinet_decision";
  if (/\b(scheme|yojana|mission|programme)\b/.test(title)) return "scheme";
  if (/\b(advisory|alert|public notice)\b/.test(title)) return "guideline";
  if (/\b(policy|framework|roadmap|strategy)\b/.test(title)) return "policy";
  if (/\b(report|index|survey|study)\b/.test(title)) return "report";
  return "press_release";
};

const parsePibListing = (html, pageUrl) => {
  const $ = cheerio.load(html);
  const records = [];
  let ministry = null;
  $("ul.num").children("h3, li").each((_, element) => {
    const node = $(element);
    if (element.tagName === "h3") {
      ministry = text(node.text());
      return;
    }
    const anchor = node.find("a[href*='PressReleseDetail']").first();
    const sourceUrl = absoluteUrl(anchor.attr("href"), pageUrl);
    const title = text(anchor.attr("title") || anchor.text());
    if (!sourceUrl || !title) return;
    const sourceRecordId =
      new URL(sourceUrl).searchParams.get("PRID") ||
      sha256(sourceUrl).slice(0, 40);
    records.push({
      sourceName: "pib",
      sourceRecordId,
      sourceUrl,
      detailUrl: sourceUrl,
      title,
      documentType: pibType(`${ministry || ""} ${title}`),
      jurisdictionLevel: "union",
      jurisdiction: "India",
      authority: "Press Information Bureau",
      ministry,
      category: "government-release",
      status: "Published",
      publicationDate: dateFromText(node.text()),
      language: "English",
      mimeType: "text/html",
      sourceClassification: "Official Government Source",
      metadata: {
        collection: "press-releases",
        releaseType: pibType(title),
      },
    });
  });
  return records;
};

const pibConnector = {
  name: "pib",
  defaultCollection: "press-releases",
  async collect(options = {}, { fetcher }) {
    const pageUrl =
      options.url ||
      "https://pib.gov.in/AllRelease.aspx?MenuId=3&lang=1&reg=3";
    try {
      const response = await fetcher.getText(pageUrl);
      const records = parsePibListing(response.body, pageUrl).slice(
        0,
        Math.max(1, Number(options.limit || 100)),
      );
      if (!options.catalogOnly) {
        for (const record of records) {
          try {
            const releaseContentUrl = record.detailUrl.replace(
              /PressReleseDetail\.aspx/i,
              "PressReleasePage.aspx",
            );
            const detail = await fetcher.getText(releaseContentUrl);
            const resources = discoverPdfLinks(
              detail.body,
              releaseContentUrl,
            );
            record.resources = resources;
            record.pdfUrl = resources[0]?.url || null;
            record.metadata.releaseContentUrl = releaseContentUrl;
          } catch (error) {
            record.metadata.detailError = error.message;
          }
        }
      }
      return {
        records,
        snapshots: [
          createSnapshot({
            sourceName: this.name,
            sourceUrl: pageUrl,
            body: response.body,
            responseStatus: response.status,
            recordCount: records.length,
            metadata: { collection: this.defaultCollection },
          }),
        ],
        errors: [],
        diagnostics: records.length
          ? []
          : [{
              type: "empty-source",
              collection: this.defaultCollection,
              message: "The official PIB release listing contained no releases.",
            }],
      };
    } catch (error) {
      return {
        records: [],
        snapshots: [],
        errors: [{ stage: "listing", message: error.message }],
        diagnostics: [{
          type: /403|forbidden/i.test(error.message) ? "blocked" : "error",
          collection: this.defaultCollection,
          message: error.message,
        }],
      };
    }
  },
};
attachConnectorLifecycle(pibConnector, ["press-releases"]);

const indiaGovConnector = {
  name: "india-gov",
  defaultCollection: "government-document-directory",
  async collect(options = {}, { fetcher }) {
    const pageUrl =
      options.url || "https://www.india.gov.in/my-government/documents";
    try {
      const response = await fetcher.getText(pageUrl);
      const $ = cheerio.load(response.body);
      const entries = [];
      const seen = new Set();
      $("a[href*='/my-government/documents?type=']").each((_, element) => {
        const name = text($(element).text());
        const directoryUrl = absoluteUrl($(element).attr("href"), pageUrl);
        if (!name || !directoryUrl || seen.has(directoryUrl)) return;
        seen.add(directoryUrl);
        entries.push({
          sourceName: "india-gov",
          entryKey: sha256(directoryUrl).slice(0, 40),
          entityType: "government_document_category",
          name,
          jurisdiction: "India",
          parentName: "National Portal of India",
          officialUrl: directoryUrl,
          directoryUrl,
          metadata: {
            sourceClassification: "Official Government Source",
            dynamicListing: true,
            limitation:
              "Document results are client-rendered; only stable public category discovery is stored.",
          },
        });
      });
      return {
        records: [],
        directoryEntries: entries.slice(
          0,
          Math.max(1, Number(options.limit || 100)),
        ),
        snapshots: [
          createSnapshot({
            sourceName: this.name,
            sourceUrl: pageUrl,
            body: response.body,
            responseStatus: response.status,
            recordCount: entries.length,
            metadata: { collection: this.defaultCollection },
          }),
        ],
        errors: [],
        diagnostics: entries.length
          ? []
          : [{
              type: "empty-source",
              collection: this.defaultCollection,
              message: "India.gov exposed no stable document categories.",
            }],
      };
    } catch (error) {
      return {
        records: [],
        directoryEntries: [],
        snapshots: [],
        errors: [{ stage: "directory", message: error.message }],
        diagnostics: [{ type: "error", message: error.message }],
      };
    }
  },
};
attachConnectorLifecycle(indiaGovConnector, [
  "government-document-directory",
]);

const statePolicyConnector = createPublicListingConnector({
  name: "state-policy",
  collection: "haryana-renewable-energy-policies",
  url:
    "https://s3f80ff32e08a25270b5f252ce39522f72.s3waas.gov.in/document-category/state-policies/",
  authority: "New and Renewable Energy Department, Haryana",
  department: "New and Renewable Energy Department",
  jurisdictionLevel: "state",
  jurisdiction: "Haryana",
  itemSelector: "tr, li, article",
  linkPattern: /\.pdf(?:$|[?#])/i,
  title: ($, anchor, row) =>
    row.find("td").first().text() || anchor.attr("title") || anchor.text(),
  documentType: (value) =>
    /regulation|order|direction/i.test(value) ? "regulation" : "policy",
  category: "state-policy",
  allowedHosts: ["s3waas.gov.in"],
  metadata: {
    sourceClassification: "State Government Source",
    state: "Haryana",
    country: "India",
  },
  extraFields: ($, anchor, row) => ({
    language: /marathi|hindi/i.test(row.text()) ? "Hindi" : "English",
    state: "Haryana",
    year: Number(row.text().match(/\b(19|20)\d{2}\b/)?.[0]) || null,
    sourceClassification: "State Government Source",
  }),
});

const policyEdgeConnector = createPublicListingConnector({
  name: "policy-edge",
  collection: "policy-bites",
  url: "https://www.policyedge.in/category/policy-bites",
  pageUrl: (page) =>
    page === 0
      ? "https://www.policyedge.in/category/policy-bites"
      : `https://www.policyedge.in/category/policy-bites?page=${page + 1}`,
  authority: "The Policy Edge",
  jurisdictionLevel: "union",
  jurisdiction: "India",
  itemSelector: "a.block",
  linkPattern: /policyedge\.in\/p\//i,
  excludePattern: /privacy|terms|submission|login/i,
  documentType: "report",
  category: "secondary-policy-research",
  allowedHosts: ["policyedge.in"],
  title: ($, anchor) =>
    (anchor.attr("title") || anchor.text())
      .replace(/\d{1,2}\s+[A-Za-z]{3,9}\s+(?:19|20)\d{2}\s*$/, "")
      .trim(),
  metadata: {
    sourceClassification: "Secondary Research Source",
    attributionRequired: true,
    robotsPath: "/category/",
  },
  extraFields: () => ({
    language: "English",
    sourceClassification: "Secondary Research Source",
  }),
});

module.exports = {
  indiaGovConnector,
  parsePibListing,
  pibConnector,
  pibType,
  policyEdgeConnector,
  statePolicyConnector,
};
