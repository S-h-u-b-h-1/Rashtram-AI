const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");

const PRS_BASE_URL = "https://prsindia.org";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_DELAY_MS = 175;

const SOURCE_DEFINITIONS = [
  {
    key: "parliament-bills",
    url: `${PRS_BASE_URL}/billtrack`,
    documentType: "bill",
    jurisdictionLevel: "parliament",
    paginated: false,
  },
  {
    key: "parliament-acts",
    url: `${PRS_BASE_URL}/acts/parliament`,
    documentType: "act",
    jurisdictionLevel: "parliament",
    paginated: false,
  },
  {
    key: "state-bills",
    url: `${PRS_BASE_URL}/bills/states`,
    documentType: "bill",
    jurisdictionLevel: "state",
    paginated: true,
  },
  {
    key: "state-acts",
    url: `${PRS_BASE_URL}/acts/states`,
    documentType: "act",
    jurisdictionLevel: "state",
    paginated: true,
  },
];

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const absoluteUrl = (value, baseUrl = PRS_BASE_URL) => {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const sourceDocumentId = (sourceUrl) => sha256(sourceUrl).slice(0, 32);

const extractYear = (title, sourceUrl = "") => {
  const currentYear = new Date().getFullYear() + 1;
  const candidates = [
    ...String(sourceUrl).matchAll(/(?:\/|_|-)(18\d{2}|19\d{2}|20\d{2})(?:\/|_|-|\.|$)/g),
    ...String(title).matchAll(/\b(18\d{2}|19\d{2}|20\d{2})\b/g),
  ]
    .map((match) => Number(match[1]))
    .filter((year) => year >= 1800 && year <= currentYear);

  return candidates.length ? candidates[candidates.length - 1] : null;
};

const resourceTypeForUrl = (url) => {
  const pathname = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (pathname.endsWith(".pdf")) return "pdf";
  if (pathname.endsWith(".doc") || pathname.endsWith(".docx")) return "document";
  return "link";
};

const buildDocument = ({
  anchor,
  documentType,
  jurisdictionLevel,
  jurisdiction,
  status,
  sourcePageUrl,
  position,
}) => {
  const title = normalizeText(anchor.attr("title") || anchor.text());
  const sourceUrl = absoluteUrl(anchor.attr("href"), sourcePageUrl);
  if (!title || !sourceUrl) return null;

  const resourceType = resourceTypeForUrl(sourceUrl);
  const isDirectFile = resourceType !== "link";

  return {
    sourceName: "prs-india",
    sourceDocumentId: sourceDocumentId(sourceUrl),
    documentType,
    jurisdictionLevel,
    jurisdiction:
      jurisdictionLevel === "parliament"
        ? "India"
        : normalizeText(jurisdiction) || "Unknown",
    title,
    year: extractYear(title, sourceUrl),
    status: normalizeText(status) || null,
    ministry: null,
    category: null,
    sourceUrl,
    detailUrl: isDirectFile ? null : sourceUrl,
    pdfUrl: resourceType === "pdf" ? sourceUrl : null,
    sourcePageUrl,
    sourceMetadata: {
      collection: jurisdictionLevel,
      listPosition: position,
      directFile: isDirectFile,
    },
    resources: isDirectFile
      ? [
          {
            label: title,
            resourceType,
            category: "Original text",
            url: sourceUrl,
            metadata: { discoveredOn: sourcePageUrl },
          },
        ]
      : [],
  };
};

const parseListingPage = (html, definition, sourcePageUrl) => {
  const $ = cheerio.load(html);
  const documents = [];

  $(".view-content .views-row").each((position, row) => {
    const rowElement = $(row);
    const anchor = rowElement
      .find(".views-field-title-field a[href]")
      .first();
    if (!anchor.length) return;

    const secondaryValue = normalizeText(
      rowElement.find(".views-field-field-bill-status").text(),
    );
    const jurisdiction =
      definition.jurisdictionLevel === "state" ? secondaryValue : "India";
    const status =
      definition.documentType === "bill" &&
      definition.jurisdictionLevel === "parliament"
        ? secondaryValue
        : null;

    const document = buildDocument({
      anchor,
      documentType: definition.documentType,
      jurisdictionLevel: definition.jurisdictionLevel,
      jurisdiction,
      status,
      sourcePageUrl,
      position,
    });
    if (document) documents.push(document);
  });

  const nextHref = $("li.next a[href]").attr("href");

  return {
    documents,
    nextUrl: absoluteUrl(nextHref, sourcePageUrl),
    title: normalizeText($("h1").first().text() || $("title").text()),
  };
};

const parseBillDetail = (html, detailUrl) => {
  const $ = cheerio.load(html);
  const title = normalizeText(
    $(".field-name-title-field h2").first().text() || $("h1").first().text(),
  );
  const ministry = normalizeText(
    $(".field-name-field-ministry .field-item").first().text(),
  );
  const status = normalizeText(
    $(".field-name-field-own-status .field-item").first().text(),
  );
  const body = normalizeText(
    $(".field-name-body .field-item").first().text(),
  );
  const breadcrumbs = $(".breadcrumb li")
    .map((_, item) => normalizeText($(item).text()))
    .get()
    .filter(Boolean);
  const ignoredBreadcrumbs = new Set([
    "Bills & Acts",
    "Bills Parliament",
    title,
  ]);
  const category =
    breadcrumbs.find(
      (value) => !ignoredBreadcrumbs.has(value) && value !== "Home",
    ) || null;

  const resources = [];
  $(".relevant_links_s").each((_, group) => {
    const groupElement = $(group);
    const resourceCategory =
      normalizeText(groupElement.find("h4").first().text()) || "Relevant link";

    groupElement.find("a[href]").each((__, item) => {
      const anchor = $(item);
      const url = absoluteUrl(anchor.attr("href"), detailUrl);
      if (!url) return;
      resources.push({
        label: normalizeText(anchor.text()) || resourceCategory,
        resourceType: resourceTypeForUrl(url),
        category: resourceCategory,
        url,
        metadata: { discoveredOn: detailUrl },
      });
    });
  });

  const timeline = [];
  $(".bp-link-slides li").each((_, item) => {
    const element = $(item);
    const timelineStatus = normalizeText(
      element.find(".field-name-field-own-status .field-item").first().text(),
    );
    const timelineTitle = normalizeText(
      element
        .find(".field-name-field-own-status-title .field-item")
        .first()
        .text(),
    );
    const timelineDate = normalizeText(
      element
        .find(".field-name-field-own-status-date .field-item")
        .first()
        .text(),
    );
    if (timelineStatus || timelineTitle || timelineDate) {
      timeline.push({
        status: timelineStatus || null,
        title: timelineTitle || null,
        date: timelineDate || null,
      });
    }
  });

  const pdfResource = resources.find(
    (resource) => resource.resourceType === "pdf",
  );

  return {
    title: title || null,
    year: extractYear(title, detailUrl),
    ministry: ministry || null,
    category,
    status: status || null,
    pdfUrl: pdfResource?.url || null,
    resources,
    metadata: {
      body: body || null,
      timeline,
      breadcrumbs,
    },
  };
};

const requestPage = async (url, options = {}) => {
  const timeout = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const attempts = options.attempts || 3;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await axios.get(url, {
        timeout,
        responseType: "text",
        headers: {
          "Cache-Control": "no-store",
          "User-Agent":
            "RashtramAI/1.0 (public legislative research catalogue)",
        },
      });
      return String(response.data);
    } catch (error) {
      lastError = error;
      const status = Number(error.response?.status);
      const retryable =
        !status || status === 408 || status === 429 || status >= 500;
      if (!retryable || attempt === attempts) throw error;
      await sleep(750 * 2 ** (attempt - 1));
    }
  }

  throw lastError;
};

const crawlDefinition = async (definition, options = {}) => {
  const delayMs = Number(options.delayMs ?? DEFAULT_DELAY_MS);
  const maxPages = Number(options.maxPages || 500);
  const documentsById = new Map();
  const snapshots = [];
  const seenPages = new Set();

  let pageUrl = definition.paginated
    ? `${definition.url}?page=1&per-page=50`
    : definition.url;

  while (pageUrl && !seenPages.has(pageUrl)) {
    if (seenPages.size >= maxPages) {
      throw new Error(
        `${definition.key} exceeded the configured ${maxPages}-page limit`,
      );
    }

    seenPages.add(pageUrl);
    const html = await requestPage(pageUrl, options);
    const parsed = parseListingPage(html, definition, pageUrl);

    snapshots.push({
      sourceName: "prs-india",
      sourceUrl: pageUrl,
      contentSha256: sha256(html),
      recordCount: parsed.documents.length,
      metadata: {
        collection: definition.key,
        pageNumber: seenPages.size,
        pageTitle: parsed.title,
      },
    });

    for (const document of parsed.documents) {
      documentsById.set(document.sourceDocumentId, document);
    }

    if (!definition.paginated || parsed.documents.length === 0) break;
    pageUrl = parsed.nextUrl;
    if (pageUrl && delayMs > 0) await sleep(delayMs);
  }

  return {
    definition,
    documents: [...documentsById.values()],
    snapshots,
    pagesFetched: seenPages.size,
  };
};

module.exports = {
  PRS_BASE_URL,
  SOURCE_DEFINITIONS,
  absoluteUrl,
  crawlDefinition,
  extractYear,
  normalizeText,
  parseBillDetail,
  parseListingPage,
  requestPage,
  resourceTypeForUrl,
  sha256,
  sleep,
  sourceDocumentId,
};
