const {
  createPublicListingConnector,
} = require("./publicListingConnector");
const { createRssConnector } = require("./rssConnector");

const policyType = (value) => {
  const text = String(value || "").toLowerCase();
  if (text.includes("white paper")) return "white_paper";
  if (text.includes("strategy") || text.includes("roadmap")) {
    return "strategy_paper";
  }
  if (text.includes("discussion paper")) return "discussion_paper";
  if (text.includes("office memorandum")) return "office_memorandum";
  if (text.includes("circular")) return "circular";
  if (text.includes("scheme")) return "scheme";
  if (text.includes("policy")) return "policy";
  if (
    text.includes("guideline") ||
    text.includes("toolkit") ||
    text.includes("framework") ||
    text.includes("manual") ||
    text.includes("standard operating procedure")
  ) {
    return "guideline";
  }
  if (text.includes("recommendation")) return "recommendation";
  return "report";
};

const nitiAayogConnector = createPublicListingConnector({
  name: "niti-aayog",
  collection: "reports-and-publications",
  url: "https://www.niti.gov.in/publications/division-reports",
  pageUrl: (page) =>
    `https://www.niti.gov.in/publications/division-reports?page=${page}`,
  authority: "NITI Aayog",
  ministry: "Ministry of Planning",
  jurisdictionLevel: "union",
  jurisdiction: "India",
  itemSelector: "tr",
  linkPattern: /\.(pdf|docx?)(?:$|[?#])/i,
  title: ($, anchor, row) =>
    row.find("td").eq(1).text() ||
    anchor.attr("title") ||
    anchor.text(),
  documentType: policyType,
  category: "public-policy",
  allowedHosts: ["niti.gov.in"],
});

const pibConnector = createRssConnector({
  name: "pib",
  collection: "press-releases",
  url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1",
  authority: "Press Information Bureau",
  ministry: "Ministry of Information and Broadcasting",
  jurisdictionLevel: "union",
  jurisdiction: "India",
  documentType: (value) =>
    /\b(cabinet|union cabinet|ccpa|ccs)\b/i.test(value)
      ? "cabinet_decision"
      : "press_release",
});

const myGovConnector = createPublicListingConnector({
  name: "mygov",
  collection: "public-consultations",
  url: "https://www.mygov.in/home/discuss/",
  authority: "MyGov",
  ministry: "Ministry of Electronics and Information Technology",
  jurisdictionLevel: "union",
  jurisdiction: "India",
  itemSelector: "article, .views-row, .card, li",
  linkPattern:
    /\/(group-issue|mygov-survey)\/|public consultation|draft policy|consultation paper/i,
  excludePattern: /login|register|comment|share/i,
  documentType: "consultation_paper",
  category: "public-consultation",
  allowedHosts: ["mygov.in"],
});

const ndapConnector = createPublicListingConnector({
  name: "ndap",
  collection: "public-datasets",
  url: "https://ndap.niti.gov.in/",
  authority: "National Data and Analytics Platform",
  ministry: "Ministry of Planning",
  jurisdictionLevel: "union",
  jurisdiction: "India",
  itemSelector: "article, li, .card, [class*='dataset']",
  linkPattern: /dataset|data-catalog|catalogue/i,
  excludePattern: /login|terms|privacy|help|about/i,
  documentType: "report",
  category: "open-government-data",
  allowedHosts: ["ndap.niti.gov.in"],
  emptyMessage:
    "NDAP is reachable but its dataset catalogue did not expose crawlable dataset links in the server-rendered response.",
});

const ogdConnector = createPublicListingConnector({
  name: "ogd-india",
  collection: "open-government-data-catalogues",
  url: "https://www.data.gov.in/catalogs",
  authority: "Open Government Data Platform India",
  ministry: "Ministry of Electronics and Information Technology",
  jurisdictionLevel: "union",
  jurisdiction: "India",
  itemSelector: "article, li, .card, .views-row, [class*='catalog']",
  linkPattern: /\/catalog\/|\/resource\/|catalog api|dataset|zip download/i,
  excludePattern: /login|register|privacy|terms|help/i,
  documentType: "report",
  category: "open-government-data",
  allowedHosts: ["data.gov.in"],
  emptyMessage:
    "The OGD catalogue was reachable but exposed no crawlable catalogue links in the bounded server-rendered sample.",
});

const ministryEnvironmentConnector = createPublicListingConnector({
  name: "ministry-environment",
  collection: "new-guidelines",
  url: "https://moef.gov.in/new-guidelines",
  authority: "Ministry of Environment, Forest and Climate Change",
  ministry: "Ministry of Environment, Forest and Climate Change",
  jurisdictionLevel: "union",
  jurisdiction: "India",
  itemSelector: "li",
  linkSelector: ".content-box a[href]",
  linkPattern: /\.(pdf|docx?)(?:$|[?#])/i,
  title: ($, anchor) => anchor.text() || anchor.attr("title"),
  documentType: policyType,
  category: "environment-policy",
  allowedHosts: ["moef.gov.in"],
});

module.exports = {
  ministryEnvironmentConnector,
  myGovConnector,
  ndapConnector,
  nitiAayogConnector,
  ogdConnector,
  pibConnector,
  policyType,
};
