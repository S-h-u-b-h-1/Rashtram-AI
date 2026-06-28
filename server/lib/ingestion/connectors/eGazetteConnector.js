const cheerio = require("cheerio");
const { sha256 } = require("../core/hashing");
const { createSnapshot } = require("../core/sourceSnapshots");

const EGAZETTE_HOME = "https://egazette.gov.in/";

const normalize = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const parseGazetteDate = (value) => {
  const match = String(value || "").match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/,
  );
  if (!match) return null;
  const month = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  }[match[2].toLowerCase()];
  return month
    ? `${match[3]}-${month}-${String(match[1]).padStart(2, "0")}`
    : null;
};

const pdfUrlForGazette = (gazetteId, publicationDate) => {
  const archiveId = String(gazetteId || "").match(/-(\d+)$/)?.[1];
  const year = String(publicationDate || "").slice(0, 4);
  if (!archiveId || !year) return null;
  return `https://egazette.gov.in/WriteReadData/${year}/${archiveId}.pdf`;
};

const parseHomePage = (html, pageUrl = EGAZETTE_HOME) => {
  const $ = cheerio.load(html);
  const records = [];
  $("[id*='lbl_UGID']").each((_, element) => {
    const gazetteIdentifier = normalize($(element).text());
    if (!/^CG-[A-Z]{2}-[EW]-\d{8}-\d+$/i.test(gazetteIdentifier)) return;
    const row = $(element).closest("tr");
    const ministry = normalize(row.find("[id*='lbl_Ministry']").first().text());
    const subject = normalize(row.find("[id*='lbl_Subject']").first().text());
    const rawDate = normalize(row.find("[id*='lbl_Date']").first().text());
    const publicationDate = parseGazetteDate(rawDate);
    const pdfUrl = pdfUrlForGazette(gazetteIdentifier, publicationDate);
    const weekly = /-W-/.test(gazetteIdentifier);

    records.push({
      sourceName: "egazette",
      sourceRecordId: gazetteIdentifier,
      sourceUrl: pdfUrl || pageUrl,
      detailUrl: pageUrl,
      pdfUrl,
      documentType: weekly ? "gazette" : "notification",
      jurisdictionLevel: "union",
      jurisdiction: "India",
      title:
        subject ||
        `${weekly ? "Weekly Gazette" : "Extraordinary Gazette"} ${gazetteIdentifier}`,
      authority: "Directorate of Printing, Government of India",
      ministry: ministry || null,
      category: weekly ? "weekly-gazette" : "extraordinary-gazette",
      gazetteIdentifier,
      legalIdentifier: gazetteIdentifier,
      publicationDate,
      year: publicationDate ? Number(publicationDate.slice(0, 4)) : null,
      resources: pdfUrl
        ? [
            {
              label: `Official Gazette PDF ${gazetteIdentifier}`,
              resourceType: "pdf",
              category: "official-gazette",
              url: pdfUrl,
              metadata: {
                fileSize: normalize(
                  row.find("[id*='lbl_FileSize']").first().text(),
                ),
              },
            },
          ]
        : [],
      metadata: {
        rawPublicationDate: rawDate,
        officialArchiveId: gazetteIdentifier.match(/-(\d+)$/)?.[1] || null,
      },
    });
  });
  return records;
};

const eGazetteConnector = {
  name: "egazette",
  defaultCollection: "recent",

  async collect(options = {}, { fetcher }) {
    const response = await fetcher.getText(EGAZETTE_HOME);
    const pageHash = sha256(response.body);
    const records = parseHomePage(response.body)
      .filter(
        (record) =>
          (!options.from ||
            !record.publicationDate ||
            record.publicationDate >= options.from) &&
          (!options.to ||
            !record.publicationDate ||
            record.publicationDate <= options.to),
      )
      .slice(0, Number(options.limit || 50))
      .map((record) => ({ ...record, htmlHash: pageHash }));
    return {
      records,
      snapshots: [
        createSnapshot({
          sourceName: this.name,
          sourceUrl: EGAZETTE_HOME,
          body: response.body,
          responseStatus: response.status,
          recordCount: records.length,
          metadata: {
            collection: "recent",
            note: "Recent official homepage listings; PDFs use the official WriteReadData archive.",
          },
        }),
      ],
      errors: [],
    };
  },
};

module.exports = {
  EGAZETTE_HOME,
  eGazetteConnector,
  parseGazetteDate,
  parseHomePage,
  pdfUrlForGazette,
};
