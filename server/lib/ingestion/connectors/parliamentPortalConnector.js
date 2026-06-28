const cheerio = require("cheerio");
const { sha256 } = require("../core/hashing");
const {
  normalizeDate,
  normalizeDocumentType,
} = require("../core/normalizer");
const {
  absoluteUrl,
  discoverPdfLinks,
} = require("../core/pdfDiscovery");
const { createSnapshot } = require("../core/sourceSnapshots");
const { attachConnectorLifecycle } = require("./connectorLifecycle");

const clean = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const mapWithConcurrency = async (items, concurrency, callback) => {
  const workerCount = Math.max(
    1,
    Math.min(Number(concurrency) || 1, items.length || 1),
  );
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await callback(items[index], index);
      }
    }),
  );
};

const linkedDocumentUrl = ($, row, pageUrl) => {
  const candidates = $(row)
    .find("a[href]")
    .map((_, anchor) => absoluteUrl($(anchor).attr("href"), pageUrl))
    .get()
    .filter(Boolean);
  return (
    candidates.find((url) =>
      /(\/getFile\/|\/uploads\/|\/bitstream\/|\/items\/|\/handle\/|\.pdf(?:$|[?#]))/i.test(
        url,
      ),
    ) || null
  );
};

const dateFromCells = (cells) => {
  const raw = cells.find((cell) =>
    /(?:\d{1,2}[-/\s][A-Za-z]{3,9}[-/\s]\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|[A-Za-z]{3}[-\s]\d{4})/i.test(
      cell,
    ),
  );
  return normalizeDate(
    raw?.match(
      /(?:\d{1,2}[-/\s][A-Za-z]{3,9}[-/\s]\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
    )?.[0] || raw,
  );
};

const titleFromCells = (cells, page) => {
  if (Number.isInteger(page.titleCell) && cells[page.titleCell]) {
    return cells[page.titleCell];
  }
  const candidates = cells.filter(
    (cell) =>
      cell.length >= 8 &&
      !/^(view|download|print|scheduled|reminded|filter)$/i.test(cell) &&
      !normalizeDate(cell),
  );
  return candidates.sort((left, right) => right.length - left.length)[0] || null;
};

const parseParliamentListing = (html, pageUrl, config, page) => {
  const $ = cheerio.load(html);
  const records = [];
  const seen = new Set();

  $("tr").each((_, row) => {
    if ($(row).find("td").length === 0) return;
    const cells = $(row)
      .find("th,td")
      .map((__, cell) => clean($(cell).text()))
      .get()
      .filter(Boolean);
    if (cells.length < 2) return;

    const title = titleFromCells(cells, page);
    const documentUrl = linkedDocumentUrl($, row, pageUrl);
    if (!title || title.length < 8) return;
    if (page.rowPattern && !page.rowPattern.test(`${title} ${cells.join(" ")}`)) {
      return;
    }

    const publicationDate = dateFromCells(cells);
    const sourceUrl = documentUrl || pageUrl;
    const stableIdentity = documentUrl ||
      (page.identityCells || [])
        .map((index) => cells[index])
        .filter(Boolean)
        .join("|") ||
      cells.join("|");
    const sourceRecordId = sha256(
      `${config.name}|${page.collection}|${stableIdentity}`,
    ).slice(0, 40);
    if (seen.has(sourceRecordId)) return;
    seen.add(sourceRecordId);
    const pdfUrl =
      /\.pdf(?:$|[?#])/i.test(sourceUrl) || /\/getFile\//i.test(sourceUrl)
        ? sourceUrl
        : null;

    records.push({
      sourceName: config.name,
      sourceRecordId,
      sourceUrl,
      detailUrl: sourceUrl,
      pdfUrl,
      documentType: normalizeDocumentType(page.documentType, {
        title,
        category: page.collection,
      }),
      jurisdictionLevel: "union",
      jurisdiction: "India",
      title: page.titlePrefix ? `${page.titlePrefix}: ${title}` : title,
      authority: page.authority || config.authority,
      ministry:
        Number.isInteger(page.ministryCell) && cells[page.ministryCell]
          ? cells[page.ministryCell]
          : null,
      status:
        Number.isInteger(page.statusCell) && cells[page.statusCell]
          ? cells[page.statusCell]
          : null,
      category: page.collection,
      publicationDate,
      year: publicationDate
        ? Number(publicationDate.slice(0, 4))
        : Number.parseInt(
            cells.join(" ").match(/\b(18|19|20)\d{2}\b/)?.[0],
            10,
          ) || null,
      resources: pdfUrl
        ? [
            {
              label: title,
              resourceType: "pdf",
              category: page.collection,
              url: pdfUrl,
            },
          ]
        : [],
      metadata: {
        collection: page.collection,
        listingUrl: pageUrl,
        listingCells: cells,
      },
    });
  });
  return records;
};

const metadataValue = ($, label) => {
  const row = $("tr")
    .filter((_, element) =>
      new RegExp(`^${label}\\s*:?`, "i").test(clean($(element).text())),
    )
    .first();
  return clean(row.find("td").last().text()) || null;
};

const parseParliamentDetail = (html, detailUrl, record) => {
  const $ = cheerio.load(html);
  const meta = (name) =>
    clean($(`meta[name='${name}']`).first().attr("content")) || null;
  const pdfResources = discoverPdfLinks(html, detailUrl);
  const title =
    meta("DC.title") ||
    meta("citation_title") ||
    metadataValue($, "Title") ||
    record.title;
  const rawDate =
    meta("DCTERMS.issued") ||
    meta("citation_date") ||
    metadataValue($, "Date");
  const type = metadataValue($, "Type");
  const pdfUrl =
    absoluteUrl(meta("citation_pdf_url"), detailUrl) ||
    pdfResources[0]?.url ||
    record.pdfUrl ||
    null;

  return {
    ...record,
    title,
    pdfUrl,
    publicationDate: normalizeDate(rawDate) || record.publicationDate,
    documentType: normalizeDocumentType(type || record.documentType, {
      title,
      category: record.category,
    }),
    ministry: metadataValue($, "Relation Ministry") || record.ministry,
    department: metadataValue($, "Department") || record.department,
    resources: [...(record.resources || []), ...pdfResources].filter(
      (resource, index, resources) =>
        resources.findIndex((candidate) => candidate.url === resource.url) ===
        index,
    ),
    metadata: {
      ...(record.metadata || {}),
      language: metadataValue($, "Language"),
      parliamentNumber:
        metadataValue($, "Lok Sabha Number") ||
        metadataValue($, "Rajya Sabha Number"),
      sessionNumber: metadataValue($, "Session Number"),
    },
  };
};

const pageUrlAtOffset = (page, pageNumber) => {
  if (page.pagination !== "offset" || pageNumber === 0) return page.url;
  const url = new URL(page.url);
  url.searchParams.set("offset", String(pageNumber * (page.pageSize || 20)));
  return url.toString();
};

const createParliamentPortalConnector = (config) => {
  const connector = {
    name: config.name,
    defaultCollection: config.defaultCollection || config.pages[0].collection,

    async fetchDetails(record, { fetcher } = {}) {
      if (
        !fetcher ||
        !record.detailUrl ||
        record.pdfUrl ||
        record.detailUrl === record.metadata?.listingUrl
      ) {
        return record;
      }
      const response = await fetcher.getText(record.detailUrl);
      return {
        ...parseParliamentDetail(response.body, record.detailUrl, record),
        htmlHash: sha256(response.body),
      };
    },

    async collect(options = {}, { fetcher }) {
      const requested = String(
        options.collection || options.collections || this.defaultCollection,
      )
        .split(",")
        .map((value) => value.trim());
      const pages =
        requested.includes("all")
          ? config.pages
          : config.pages.filter((page) => requested.includes(page.collection));
      if (!pages.length) {
        throw new Error(
          `Unknown ${config.name} collection: ${requested.join(", ")}`,
        );
      }

      const records = [];
      const snapshots = [];
      const errors = [];
      const diagnostics = [];
      for (const page of pages) {
        const pageCount =
          page.pagination === "offset"
            ? Math.max(1, Number(options.maxPages || 1))
            : 1;
        for (let pageNumber = 0; pageNumber < pageCount; pageNumber += 1) {
          const pageUrl = pageUrlAtOffset(page, pageNumber);
          try {
            const response = await fetcher.getText(pageUrl);
            const parsed = parseParliamentListing(
              response.body,
              pageUrl,
              config,
              page,
            ).map((record) => ({
              ...record,
              htmlHash: sha256(response.body),
            }));
            records.push(...parsed);
            snapshots.push(
              createSnapshot({
                sourceName: config.name,
                sourceUrl: pageUrl,
                body: response.body,
                responseStatus: response.status,
                recordCount: parsed.length,
                metadata: {
                  collection: page.collection,
                  accessMethod: page.accessMethod || "official-html",
                },
              }),
            );
            if (!parsed.length && page.blockedWhenEmpty) {
              diagnostics.push({
                type: "blocked",
                collection: page.collection,
                message: page.blockedReason,
              });
            }
          } catch (error) {
            errors.push({
              stage: "listing",
              collection: page.collection,
              message: error.message,
            });
          }
        }
      }

      const limited = records.slice(0, Number(options.limit || records.length));
      if (!options.catalogOnly) {
        await mapWithConcurrency(
          limited,
          options.detailConcurrency,
          async (record, index) => {
            try {
              limited[index] = await this.fetchDetails(record, {
                fetcher,
              });
            } catch (error) {
              errors.push({
                stage: "detail",
                sourceRecordId: record.sourceRecordId,
                message: error.message,
              });
            }
          },
        );
      }
      return { records: limited, snapshots, errors, diagnostics };
    },
  };

  return attachConnectorLifecycle(
    connector,
    config.pages.map((page) => page.collection),
  );
};

module.exports = {
  createParliamentPortalConnector,
  mapWithConcurrency,
  parseParliamentDetail,
  parseParliamentListing,
};
