const {
  createPublicListingConnector,
} = require("./publicListingConnector");
const { createSnapshot } = require("../core/sourceSnapshots");
const { normalizeDate } = require("../core/normalizer");
const { attachConnectorLifecycle } = require("./connectorLifecycle");

const regulatorType = (value) => {
  const text = String(value || "").toLowerCase();
  if (text.includes("consultation") || text.includes("draft")) {
    return "consultation_paper";
  }
  if (text.includes("master direction")) return "guideline";
  if (text.includes("regulation")) return "regulation";
  if (text.includes("notification")) return "notification";
  if (text.includes("circular")) return "circular";
  if (text.includes("order")) return "order";
  if (text.includes("guideline") || text.includes("direction")) {
    return "guideline";
  }
  if (text.includes("report") || text.includes("study")) return "report";
  return "other";
};

const regulatorRecordHasEvidence = (record, context) => {
  if (context.isFile || record.publicationDate) return true;
  const url = new URL(record.sourceUrl);
  const page = new URL(context.pageUrl);
  if (
    url.origin === page.origin &&
    url.pathname === page.pathname &&
    url.search === page.search
  ) {
    return false;
  }
  return /(?:[?&](?:id|Id|ID)=\d+|\/(?:master-circulars?|circulars?|notifications?|orders?|consultation-papers?|recommendations?|regulations?|guidelines?)\/[^/?#]{5,})/i.test(
    `${url.pathname}${url.search}`,
  );
};

const configs = [
  {
    name: "regulator-rbi",
    collection: "rbi-notifications",
    url: "https://www.rbi.org.in/Scripts/NotificationUser.aspx",
    authority: "Reserve Bank of India",
    linkPattern:
      /NotificationUser\.aspx\?Id=|master direction|circular|notification|guideline|draft/i,
    allowedHosts: ["rbi.org.in"],
  },
  {
    name: "regulator-sebi",
    collection: "sebi-legal",
    url:
      "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&smid=0&ssid=6",
    authority: "Securities and Exchange Board of India",
    linkPattern:
      /legal|circular|master circular|regulation|consultation|sebi_data\/attachdocs/i,
    allowedHosts: ["sebi.gov.in"],
  },
  {
    name: "regulator-trai",
    collection: "trai-consultations",
    url: "https://www.trai.gov.in/release-publication/consultation",
    authority: "Telecom Regulatory Authority of India",
    linkPattern:
      /consultation|draft regulation|recommendation|sites\/default\/files\/.*\.pdf/i,
    allowedHosts: ["trai.gov.in"],
  },
  {
    name: "regulator-uidai",
    collection: "uidai-circulars",
    url:
      "https://uidai.gov.in/en/about-uidai/legal-framework/circulars.html",
    authority: "Unique Identification Authority of India",
    linkPattern:
      /circular|memorandum|notification|policy|guideline|sop|\.pdf(?:$|[?#])/i,
    allowedHosts: ["uidai.gov.in"],
  },
  {
    name: "regulator-cerc",
    collection: "cerc-regulations",
    url: "https://cercind.gov.in/current_reg.html",
    authority: "Central Electricity Regulatory Commission",
    linkPattern:
      /regulation|gazette|notification|guideline|statement of reasons|discussion paper|\.pdf/i,
    allowedHosts: ["cercind.gov.in"],
  },
  {
    name: "regulator-irdai",
    collection: "irdai-regulations",
    url: "https://irdai.gov.in/regulations",
    authority: "Insurance Regulatory and Development Authority of India",
    linkPattern:
      /regulation|circular|guideline|master circular|notification|order|\.pdf/i,
    allowedHosts: ["irdai.gov.in"],
  },
  {
    name: "regulator-pfrda",
    collection: "pfrda-circulars",
    url:
      "https://www.pfrda.org.in/web/pfrda/regulatory-framework/circulars",
    authority: "Pension Fund Regulatory and Development Authority",
    linkPattern:
      /circular|regulation|guideline|notification|consultation|\.pdf/i,
    allowedHosts: ["pfrda.org.in"],
  },
  {
    name: "regulator-nmc",
    collection: "nmc-rules-regulations",
    url: "https://www.nmc.org.in/rules-regulations-nmc/",
    authority: "National Medical Commission",
    linkPattern: /rule|regulation|guideline|notification|\.pdf/i,
    allowedHosts: ["nmc.org.in"],
  },
  {
    name: "regulator-aicte",
    collection: "aicte-policy",
    url: "https://www.aicte-india.org/bureaus/policy-academic-planning",
    authority: "All India Council for Technical Education",
    linkPattern:
      /policy|regulation|guideline|approval process|circular|notification|\.pdf/i,
    allowedHosts: ["aicte-india.org"],
  },
  {
    name: "regulator-ugc",
    collection: "ugc-notices",
    url: "https://www.ugc.gov.in/Notices",
    authority: "University Grants Commission",
    linkPattern:
      /regulation|guideline|circular|notification|public notice|\.pdf/i,
    allowedHosts: ["ugc.gov.in"],
  },
  {
    name: "regulator-ec",
    collection: "election-commission",
    url: "https://www.eci.gov.in/legal-and-policy",
    authority: "Election Commission of India",
    linkPattern:
      /order|instruction|guideline|manual|notification|handbook|\.pdf/i,
    allowedHosts: ["eci.gov.in"],
  },
  {
    name: "regulator-nclat",
    collection: "nclat-daily-orders",
    url: "https://nclat.nic.in/daily-order-data",
    authority: "National Company Law Appellate Tribunal",
    linkPattern: /daily order|judgement|order|download|\.pdf/i,
    allowedHosts: ["nclat.nic.in"],
  },
  {
    name: "regulator-gst-council",
    collection: "gst-council-decisions",
    url: "https://www.gstcouncil.gov.in/",
    authority: "Goods and Services Tax Council",
    linkPattern:
      /recommendation|decision|notification|circular|press release|\.pdf/i,
    allowedHosts: ["gstcouncil.gov.in"],
  },
  {
    name: "regulator-cbdt",
    collection: "cbdt-circulars",
    url: "https://www.incometaxindia.gov.in/en/circulars",
    authority: "Central Board of Direct Taxes",
    linkPattern: /circular|notification|order|instruction|\.pdf/i,
    allowedHosts: ["incometaxindia.gov.in"],
  },
  {
    name: "regulator-cbic",
    collection: "cbic-tax-information",
    url: "https://taxinformation.cbic.gov.in/",
    authority: "Central Board of Indirect Taxes and Customs",
    linkPattern:
      /notification|circular|instruction|guideline|order|regulation|\.pdf/i,
    allowedHosts: ["cbic.gov.in"],
  },
];

const regulatorConnectors = configs.map((config) =>
  createPublicListingConnector({
    ...config,
    jurisdictionLevel: "union",
    jurisdiction: "India",
    documentType: regulatorType,
    category: "regulatory",
    recordFilter: regulatorRecordHasEvidence,
    emptyMessage:
      "The regulator portal was reachable but exposed no matching crawlable records in this bounded sample.",
  }),
);

const cleanMarkup = (value) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const parseCciFiles = (value) => {
  try {
    const decoded = String(value || "")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
    const parsed = JSON.parse(decoded);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseCciRegulationsPayload = (payload) => {
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error("CCI regulations response did not contain a data array");
  }
  return payload.data
    .map((item) => {
      const id = Number(item?.id);
      const title = cleanMarkup(item?.title || item?.description);
      if (!Number.isInteger(id) || !title) return null;
      const files = parseCciFiles(item.file_content);
      const resources = files
        .map((file) => {
          const relative = String(file?.file_name || "").replace(/\\\//g, "/");
          if (!relative || !/\.pdf(?:$|[?#])/i.test(relative)) return null;
          return {
            label: cleanMarkup(file.title) || title,
            resourceType: "file",
            category: "regulatory",
            url: new URL(relative, "https://www.cci.gov.in/public/").toString(),
            metadata: {
              mimeType: "application/pdf",
              fileSizeKilobytes: Number(
                String(file.file_size || "").replace(/,/g, ""),
              ) || null,
            },
          };
        })
        .filter(Boolean);
      const sourceUrl = `https://www.cci.gov.in/public/legal-framwork/regulations/${id}/0`;
      return {
        sourceName: "regulator-cci",
        sourceRecordId: `cci-regulation:${id}`,
        sourceUrl,
        detailUrl: sourceUrl,
        pdfUrl: resources[0]?.url || null,
        title,
        documentType: "regulation",
        jurisdictionLevel: "union",
        jurisdiction: "India",
        authority: "Competition Commission of India",
        category: "regulatory",
        status: "Published",
        publicationDate: normalizeDate(item.order_date),
        mimeType: resources[0] ? "application/pdf" : "text/html",
        resources,
        metadata: {
          collection: "cci-legal-framework",
          cciPageSlug: item.page_slug || null,
          officialApi: "fetch-regulationslist",
        },
      };
    })
    .filter(Boolean);
};

const cciConnector = attachConnectorLifecycle(
  {
    name: "regulator-cci",
    defaultCollection: "cci-legal-framework",
    async collect(options = {}, { fetcher }) {
      const limit = Math.max(1, Number(options.limit || 100));
      const pageSize = Math.min(100, Math.max(1, Number(options.pageSize || limit)));
      const maxPages = Math.max(1, Number(options.maxPages || 1));
      const records = [];
      const snapshots = [];
      const errors = [];
      let recordsTotal = null;

      for (let page = 0; page < maxPages && records.length < limit; page += 1) {
        const start = page * pageSize;
        const endpoint = new URL(
          "https://www.cci.gov.in/public/legal-framwork/fetch-regulationslist",
        );
        endpoint.searchParams.set("draw", String(page + 1));
        endpoint.searchParams.set("start", String(start));
        endpoint.searchParams.set("length", String(pageSize));
        endpoint.searchParams.set("searchString", "");
        endpoint.searchParams.set("fromdate", "");
        endpoint.searchParams.set("todate", "");
        try {
          const response = await fetcher.getText(endpoint.toString());
          const payload = JSON.parse(response.body);
          const pageRecords = parseCciRegulationsPayload(payload);
          recordsTotal = Number(payload.recordsFiltered ?? payload.recordsTotal);
          records.push(...pageRecords);
          snapshots.push(
            createSnapshot({
              sourceName: this.name,
              sourceUrl: endpoint.toString(),
              body: response.body,
              responseStatus: response.status,
              recordCount: pageRecords.length,
              metadata: {
                collection: this.defaultCollection,
                page,
                recordsTotal: Number.isFinite(recordsTotal) ? recordsTotal : null,
              },
            }),
          );
          if (!pageRecords.length || records.length >= recordsTotal) break;
        } catch (error) {
          errors.push({
            stage: "listing",
            collection: this.defaultCollection,
            page,
            code: "SOURCE_PAYLOAD_INVALID",
            message: error.message,
          });
          break;
        }
      }
      return {
        records: records.slice(0, limit),
        snapshots,
        errors,
        diagnostics: records.length || errors.length
          ? []
          : [{
              type: "empty-source",
              collection: this.defaultCollection,
              message: "CCI returned a valid empty regulations listing.",
            }],
      };
    },
  },
  ["cci-legal-framework"],
);

regulatorConnectors.push(cciConnector);

const ncltConnector = {
  name: "regulator-nclt",
  defaultCollection: "nclt-orders",
  async collect(options = {}, { fetcher }) {
    const url = options.url || "https://nclt.gov.in/order-date-wise";
    try {
      const response = await fetcher.getText(url);
      const captchaProtected = /captcha|human visitor|enter captcha/i.test(
        response.body,
      );
      return {
        records: [],
        snapshots: [
          createSnapshot({
            sourceName: this.name,
            sourceUrl: url,
            body: response.body,
            responseStatus: response.status,
            recordCount: 0,
            metadata: {
              collection: this.defaultCollection,
              access: captchaProtected ? "captcha-protected" : "no-public-index",
            },
          }),
        ],
        errors: [],
        diagnostics: [
          {
            type: captchaProtected ? "blocked" : "empty-source",
            collection: this.defaultCollection,
            message: captchaProtected
              ? "NCLT order search requires CAPTCHA interaction; automated collection is intentionally disabled."
              : "NCLT exposed no stable public order links in the bounded sample.",
          },
        ],
      };
    } catch (error) {
      return {
        records: [],
        snapshots: [],
        errors: [{ stage: "listing", message: error.message }],
        diagnostics: [
          {
            type: "error",
            collection: this.defaultCollection,
            message: error.message,
          },
        ],
      };
    }
  },
};
attachConnectorLifecycle(ncltConnector, [ncltConnector.defaultCollection]);
regulatorConnectors.push(ncltConnector);

module.exports = {
  REGULATOR_SOURCE_CONFIGS: configs,
  ncltConnector,
  regulatorConnectors,
  cciConnector,
  parseCciRegulationsPayload,
  regulatorRecordHasEvidence,
  regulatorType,
};
