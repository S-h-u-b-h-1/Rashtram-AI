const cheerio = require("cheerio");
const { absoluteUrl } = require("../core/pdfDiscovery");
const { sha256 } = require("../core/hashing");
const { inferDocumentType, normalizeDate } = require("../core/normalizer");
const { createSnapshot } = require("../core/sourceSnapshots");
const { attachConnectorLifecycle } = require("./connectorLifecycle");

const normalize = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const MIME_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  html: "text/html",
};

const fileMetadata = (url, text = "") => {
  const extension = new URL(url).pathname
    .split(".")
    .at(-1)
    ?.toLowerCase();
  const sizeMatch = String(text).match(
    /(\d+(?:\.\d+)?)\s*(kb|mb|gb)\b/i,
  );
  const multiplier = {
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
  }[sizeMatch?.[2]?.toLowerCase()];
  return {
    mimeType: MIME_TYPES[extension] || "text/html",
    fileSizeBytes: sizeMatch
      ? Math.round(Number(sizeMatch[1]) * multiplier)
      : null,
  };
};

const dateFromText = (value) => {
  const text = normalize(value);
  const candidates = [
    text.match(/\b\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}\b/)?.[0],
    text.match(
      /\b\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:19|20)\d{2}\b/i,
    )?.[0],
    text.match(
      /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/i,
    )?.[0],
    text.match(
      /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+(?:19|20)\d{2}\b/i,
    )?.[0],
  ].filter(Boolean);
  return normalizeDate(candidates[0]);
};

const titleFromAnchor = ($, element, config) => {
  const anchor = $(element);
  const container = anchor.closest(
    config.itemSelector ||
      "tr, article, li, .views-row, .card, .item, .list-group-item",
  );
  if (typeof config.title === "function") {
    return normalize(config.title($, anchor, container));
  }
  const anchorTitle = normalize(
    anchor.attr("title") ||
      anchor.attr("aria-label") ||
      anchor.text(),
  );
  if (
    anchorTitle &&
    !/^(download|view|read more|more|pdf|document|details?)$/i.test(
      anchorTitle,
    )
  ) {
    return anchorTitle;
  }
  const explicit = normalize(
    container
      .find(config.titleSelector || "h1, h2, h3, h4, .title, td")
      .first()
      .text(),
  );
  return explicit || normalize(container.text()).slice(0, 500);
};

const parseListing = (html, pageUrl, config) => {
  const $ = cheerio.load(html);
  const records = [];
  const seen = new Set();
  $(config.linkSelector || "a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const url = absoluteUrl(href, pageUrl);
    if (!url || seen.has(url)) return;
    const title = titleFromAnchor($, element, config);
    const context = normalize(
      $(element)
        .closest(
          config.itemSelector ||
            "tr, article, li, .views-row, .card, .item, .list-group-item",
        )
        .text(),
    );
    const testValue = `${title} ${context} ${url}`;
    if (!title || title.length < 4) return;
    if (config.linkPattern && !config.linkPattern.test(testValue)) return;
    if (config.excludePattern && config.excludePattern.test(testValue)) return;
    if (
      config.allowedHosts?.length &&
      !config.allowedHosts.some((host) =>
        new URL(url).hostname.endsWith(host),
      )
    ) {
      return;
    }
    seen.add(url);
    const file = fileMetadata(url, context);
    const isFile = file.mimeType !== "text/html";
    const extraFields =
      typeof config.extraFields === "function"
        ? config.extraFields($, $(element), $(element).closest(
            config.itemSelector ||
              "tr, article, li, .views-row, .card, .item, .list-group-item",
          ), context) || {}
        : {};
    const documentType =
      typeof config.documentType === "function"
        ? config.documentType(testValue)
        : config.documentType ||
          inferDocumentType({ title, category: config.collection });
    records.push({
      sourceName: config.name,
      sourceRecordId: sha256(url).slice(0, 40),
      sourceUrl: url,
      detailUrl: isFile ? pageUrl : url,
      pdfUrl: file.mimeType === "application/pdf" ? url : null,
      title,
      documentType,
      jurisdictionLevel: config.jurisdictionLevel || "union",
      jurisdiction: config.jurisdiction || "India",
      authority: config.authority,
      ministry: config.ministry,
      department: config.department,
      category: config.category || config.collection,
      status: config.status || "Published",
      publicationDate: dateFromText(context),
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      resources: [
        {
          label: title,
          resourceType: isFile ? "file" : "html",
          category: config.category || config.collection,
          url,
          metadata: {
            mimeType: file.mimeType,
            fileSizeBytes: file.fileSizeBytes,
          },
        },
      ],
      metadata: {
        collection: config.collection,
        discoveredOn: pageUrl,
        ...(config.metadata || {}),
      },
      ...extraFields,
    });
  });
  return records;
};

const createPublicListingConnector = (config) => {
  const connector = {
    ...config,
    defaultCollection: config.collection,
    async collect(options = {}, { fetcher }) {
      const maximumPages = Math.max(1, Number(options.maxPages || 1));
      const limit = Math.max(1, Number(options.limit || 100));
      const combined = {
        records: [],
        snapshots: [],
        errors: [],
        diagnostics: [],
      };
      for (let page = 0; page < maximumPages; page += 1) {
        const pageUrl =
          typeof config.pageUrl === "function"
            ? config.pageUrl(page, options)
            : options.url || config.url;
        if (!pageUrl || (page > 0 && !config.pageUrl)) break;
        try {
          const response = await fetcher.getText(pageUrl);
          const records = parseListing(response.body, pageUrl, config);
          combined.records.push(...records);
          combined.snapshots.push(
            createSnapshot({
              sourceName: config.name,
              sourceUrl: pageUrl,
              body: response.body,
              responseStatus: response.status,
              recordCount: records.length,
              metadata: { collection: config.collection, page },
            }),
          );
          if (!records.length && page > 0) break;
        } catch (error) {
          combined.errors.push({
            stage: "listing",
            collection: config.collection,
            page,
            message: error.message,
          });
          break;
        }
      }
      combined.records = combined.records
        .filter(
          (record, index, all) =>
            all.findIndex(
              (candidate) =>
                candidate.sourceRecordId === record.sourceRecordId,
            ) === index,
        )
        .slice(0, limit);
      if (!combined.records.length) {
        combined.diagnostics.push({
          type: combined.errors.length ? "error" : "empty-source",
          collection: config.collection,
          message:
            config.emptyMessage ||
            "The official listing exposed no matching public records.",
        });
      }
      return combined;
    },
  };
  return attachConnectorLifecycle(connector, [config.collection]);
};

module.exports = {
  createPublicListingConnector,
  dateFromText,
  fileMetadata,
  parseListing,
};
