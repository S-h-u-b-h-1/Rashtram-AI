const {
  createPublicListingConnector,
} = require("./publicListingConnector");
const { createSnapshot } = require("../core/sourceSnapshots");
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
    name: "regulator-cci",
    collection: "cci-legal-framework",
    url: "https://www.cci.gov.in/public/legal-framwork/regulations",
    authority: "Competition Commission of India",
    linkPattern:
      /regulation|notification|order|consultation|images\/.*\.pdf/i,
    allowedHosts: ["cci.gov.in"],
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
    emptyMessage:
      "The regulator portal was reachable but exposed no matching crawlable records in this bounded sample.",
  }),
);

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
  regulatorType,
};
