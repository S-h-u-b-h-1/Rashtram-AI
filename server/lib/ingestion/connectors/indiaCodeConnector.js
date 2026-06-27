const cheerio = require("cheerio");
const { discoverPdfLinks, absoluteUrl } = require("../core/pdfDiscovery");
const { createSnapshot } = require("../core/sourceSnapshots");

const INDIA_CODE_BASE = "https://www.indiacode.nic.in";
const CENTRAL_ACTS_HANDLE = "123456789/1362";

const normalize = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const handleId = (url) =>
  String(url || "").match(/\/handle\/123456789\/(\d+)/)?.[1] || null;

const browseUrl = (handle, type, value, options = {}) => {
  const url = new URL(`${INDIA_CODE_BASE}/handle/${handle}/browse`);
  url.searchParams.set("type", type);
  url.searchParams.set("order", "DESC");
  url.searchParams.set("rpp", String(options.pageSize || 100));
  if (value != null) url.searchParams.set("value", String(value));
  if (options.offset) url.searchParams.set("offset", String(options.offset));
  return url.toString();
};

const parseYearLinks = (html, pageUrl) => {
  const $ = cheerio.load(html);
  const years = new Map();
  $("a[href*='type=actyear'][href*='value=']").each((_, element) => {
    const label = normalize($(element).text());
    const year = Number.parseInt(label.match(/\b(18|19|20)\d{2}\b/)?.[0], 10);
    if (year) years.set(year, absoluteUrl($(element).attr("href"), pageUrl));
  });
  return [...years.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([year, url]) => ({ year, url }));
};

const parseBrowsePage = (html, pageUrl, collection) => {
  const $ = cheerio.load(html);
  const records = [];

  $("tr").each((_, row) => {
    const anchor = $(row)
      .find("a[href*='/handle/123456789/']")
      .filter((__, element) => !/browse\?/.test($(element).attr("href") || ""))
      .first();
    if (!anchor.length) return;

    const cells = $(row)
      .find("td")
      .map((__, cell) => normalize($(cell).text()))
      .get()
      .filter(Boolean);
    const date = cells.find((cell) =>
      /^\d{1,2}[-/](?:\d{1,2}|[A-Za-z]{3,9})[-/]\d{4}$/.test(cell),
    );
    const actNumber = cells.find(
      (cell) => cell !== date && /^\d{1,4}$/.test(cell),
    );
    const anchorTitle = normalize(anchor.text());
    const title =
      (anchorTitle && !/^view(?:\.{3})?$/i.test(anchorTitle)
        ? anchorTitle
        : cells
            .filter(
              (cell) =>
                cell !== date &&
                cell !== actNumber &&
                !/^view(?:\.{3})?$/i.test(cell),
            )
            .sort((left, right) => right.length - left.length)[0]) || null;
    const detailUrl = absoluteUrl(anchor.attr("href"), pageUrl);
    const sourceRecordId = handleId(detailUrl);
    if (!sourceRecordId || !title) return;
    const year =
      Number.parseInt(date?.match(/\d{4}$/)?.[0], 10) ||
      Number.parseInt(pageUrl.match(/[?&]value=((?:18|19|20)\d{2})/)?.[1], 10) ||
      null;

    records.push({
      sourceName: "india-code",
      sourceRecordId,
      sourceUrl: detailUrl,
      detailUrl,
      documentType: "act",
      jurisdictionLevel:
        collection === "central-acts" ? "union" : "state",
      jurisdiction: collection === "central-acts" ? "India" : collection,
      title,
      year,
      enactedDate: date,
      actNumber: actNumber || null,
      legalIdentifier:
        actNumber && year ? `${year}-${actNumber}` : null,
      authority: "Legislative Department, Ministry of Law and Justice",
      category: collection,
      metadata: {
        collection,
        browsePage: pageUrl,
        browseCells: cells,
      },
    });
  });
  return records;
};

const metaValues = ($, name) =>
  $(`meta[name='${name}']`)
    .map((_, element) => normalize($(element).attr("content")))
    .get()
    .filter(Boolean);

const parseDetailPage = (html, detailUrl, record) => {
  const $ = cheerio.load(html);
  const title =
    metaValues($, "DC.title")[0] ||
    metaValues($, "citation_title")[0] ||
    record.title;
  const issued =
    metaValues($, "DCTERMS.issued")[0] ||
    metaValues($, "citation_date")[0] ||
    record.enactedDate;
  const identifiers = metaValues($, "DC.identifier");
  const actNumber =
    normalize(
      $("tr")
        .filter((_, row) => /Act Number/i.test($(row).text()))
        .first()
        .find("td")
        .last()
        .text(),
    ) ||
    record.actNumber ||
    null;
  const ministry =
    metaValues($, "DC.relation").find((value) => /ministry/i.test(value)) ||
    metaValues($, "DC.relation")[0] ||
    null;
  const pdfResources = discoverPdfLinks(html, detailUrl);
  const relatedResources = [];
  const seen = new Set(pdfResources.map((resource) => resource.url));

  $("a[href]").each((_, element) => {
    const label = normalize($(element).text());
    const category = [
      "Rule",
      "Regulation",
      "Notification",
      "Order",
      "Circular",
      "Ordinance",
      "Statute",
    ].find((type) => new RegExp(type, "i").test(label));
    if (!category) return;
    const url = absoluteUrl($(element).attr("href"), detailUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    relatedResources.push({
      label,
      resourceType: /\.pdf(?:$|[?#])/i.test(url) ? "pdf" : "link",
      category: category.toLowerCase(),
      url,
    });
  });

  const pdfUrl =
    metaValues($, "citation_pdf_url")
      .map((url) => absoluteUrl(url, detailUrl))
      .find(Boolean) ||
    pdfResources[0]?.url ||
    null;
  const legalIdentifier =
    identifiers.find((value) => /^\d{4}[-/]\w+/.test(value)) ||
    record.legalIdentifier ||
    (actNumber && record.year ? `${record.year}-${actNumber}` : null);

  return {
    ...record,
    title,
    enactedDate: issued,
    publicationDate: issued,
    actNumber,
    legalIdentifier,
    ministry,
    pdfUrl,
    resources: [...pdfResources, ...relatedResources],
    metadata: {
      ...(record.metadata || {}),
      identifiers,
      dublinCoreRelations: metaValues($, "DC.relation"),
    },
  };
};

const indiaCodeConnector = {
  name: "india-code",
  defaultCollection: "central-acts",

  async collect(options = {}, { fetcher }) {
    const collection = options.collection || this.defaultCollection;
    const handle = options.handle || CENTRAL_ACTS_HANDLE;
    const snapshots = [];
    const errors = [];
    let yearPages = [];

    if (String(options.years || "").toLowerCase() === "all") {
      const url = browseUrl(handle, "actyear", null, options);
      const response = await fetcher.getText(url);
      yearPages = parseYearLinks(response.body, url);
      snapshots.push(
        createSnapshot({
          sourceName: this.name,
          sourceUrl: url,
          body: response.body,
          responseStatus: response.status,
          recordCount: yearPages.length,
          metadata: { collection, kind: "year-index" },
        }),
      );
    } else {
      const years = String(options.years || new Date().getFullYear())
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter(Boolean);
      yearPages = years.map((year) => ({
        year,
        url: browseUrl(handle, "actyear", year, options),
      }));
    }

    const maxPages = Number(options.maxPages || yearPages.length || 1);
    const records = [];
    for (const page of yearPages.slice(0, maxPages)) {
      try {
        const response = await fetcher.getText(page.url);
        const pageRecords = parseBrowsePage(
          response.body,
          page.url,
          collection,
        );
        snapshots.push(
          createSnapshot({
            sourceName: this.name,
            sourceUrl: page.url,
            body: response.body,
            responseStatus: response.status,
            recordCount: pageRecords.length,
            metadata: { collection, year: page.year, kind: "browse" },
          }),
        );
        records.push(...pageRecords);
      } catch (error) {
        errors.push({
          stage: "browse",
          year: page.year,
          message: error.message,
        });
      }
    }

    const limited = records.slice(0, Number(options.limit || records.length));
    if (!options.catalogOnly) {
      for (let index = 0; index < limited.length; index += 1) {
        try {
          const response = await fetcher.getText(limited[index].detailUrl);
          limited[index] = parseDetailPage(
            response.body,
            limited[index].detailUrl,
            limited[index],
          );
          snapshots.push(
            createSnapshot({
              sourceName: this.name,
              sourceUrl: limited[index].detailUrl,
              body: response.body,
              responseStatus: response.status,
              recordCount: 1,
              metadata: {
                collection,
                kind: "detail",
                sourceRecordId: limited[index].sourceRecordId,
              },
            }),
          );
        } catch (error) {
          errors.push({
            stage: "detail",
            sourceRecordId: limited[index].sourceRecordId,
            message: error.message,
          });
        }
      }
    }
    return { records: limited, snapshots, errors };
  },
};

module.exports = {
  CENTRAL_ACTS_HANDLE,
  INDIA_CODE_BASE,
  browseUrl,
  indiaCodeConnector,
  parseBrowsePage,
  parseDetailPage,
  parseYearLinks,
};
