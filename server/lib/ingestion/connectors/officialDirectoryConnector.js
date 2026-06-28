const cheerio = require("cheerio");
const { absoluteUrl } = require("../core/pdfDiscovery");
const { createSnapshot } = require("../core/sourceSnapshots");
const { sha256 } = require("../core/hashing");

const normalize = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const typeFromText = (value) => {
  const text = String(value || "").toLowerCase();
  const types = [
    ["committee", "committee_report"],
    ["debate", "debate"],
    ["question", "question"],
    ["proceeding", "proceeding"],
    ["memorandum", "office_memorandum"],
    ["notification", "notification"],
    ["regulation", "regulation"],
    ["guideline", "guideline"],
    ["circular", "circular"],
    ["scheme", "scheme"],
    ["policy", "policy"],
    ["rule", "rule"],
    ["bill", "bill"],
    ["act", "act"],
  ];
  return types.find(([term]) => text.includes(term))?.[1] || "other";
};

const parseOfficialDirectory = (html, pageUrl, config) => {
  const $ = cheerio.load(html);
  const records = [];
  const seen = new Set();

  $("a[href]").each((_, element) => {
    const url = absoluteUrl($(element).attr("href"), pageUrl);
    const title =
      normalize($(element).attr("title") || $(element).text()) || null;
    if (
      !url ||
      !title ||
      seen.has(url) ||
      !/\.pdf(?:$|[?#])/i.test(url)
    ) {
      return;
    }
    seen.add(url);
    const year = Number.parseInt(
      `${title} ${url}`.match(/\b(18|19|20)\d{2}\b/)?.[0],
      10,
    );
    records.push({
      sourceName: config.name,
      sourceRecordId: sha256(url).slice(0, 32),
      sourceUrl: url,
      pdfUrl: url,
      documentType: typeFromText(title),
      jurisdictionLevel: config.jurisdictionLevel || "union",
      jurisdiction: config.jurisdiction || "India",
      title,
      year: year || null,
      authority: config.authority,
      category: config.collection,
      resources: [
        {
          label: title,
          resourceType: "pdf",
          category: "official-document",
          url,
        },
      ],
      metadata: { discoveredOn: pageUrl },
    });
  });
  return records;
};

const createOfficialDirectoryConnector = (config) => ({
  ...config,
  defaultCollection: config.collection || "official-directory",
  async collect(options = {}, { fetcher }) {
    const pageUrl = options.url || config.url;
    const response = await fetcher.getText(pageUrl);
    const pageHash = sha256(response.body);
    const records = parseOfficialDirectory(
      response.body,
      pageUrl,
      config,
    )
      .slice(0, Number(options.limit || 100))
      .map((record) => ({ ...record, htmlHash: pageHash }));
    return {
      records,
      snapshots: [
        createSnapshot({
          sourceName: config.name,
          sourceUrl: pageUrl,
          body: response.body,
          responseStatus: response.status,
          recordCount: records.length,
          metadata: {
            collection: config.collection,
            directoryOnly: true,
          },
        }),
      ],
      errors: [],
    };
  },
});

module.exports = {
  createOfficialDirectoryConnector,
  parseOfficialDirectory,
  typeFromText,
};
