const cheerio = require("cheerio");
const { absoluteUrl } = require("../core/pdfDiscovery");
const { createSnapshot } = require("../core/sourceSnapshots");
const { attachConnectorLifecycle } = require("./connectorLifecycle");

const STATE_AND_UTS = {
  AN: "Andaman and Nicobar Islands",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CH: "Chandigarh",
  CG: "Chhattisgarh",
  DN: "Dadra and Nagar Haveli and Daman and Diu",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JK: "Jammu and Kashmir",
  JH: "Jharkhand",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MP: "Madhya Pradesh",
  MH: "Maharashtra",
  MN: "Manipur",
  ML: "Meghalaya",
  MZ: "Mizoram",
  NL: "Nagaland",
  OD: "Odisha",
  PY: "Puducherry",
  PB: "Punjab",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TS: "Telangana",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UK: "Uttarakhand",
  WB: "West Bengal",
};

const DIRECTORY_URL = "https://igod.gov.in/site_map";

const parseStateDirectory = (html, pageUrl = DIRECTORY_URL) => {
  const $ = cheerio.load(html);
  const discovered = new Map();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const url = absoluteUrl(href, pageUrl);
    const code = url?.match(/\/sg\/([A-Z]{2})\/categories/i)?.[1]?.toUpperCase();
    if (!code || !STATE_AND_UTS[code]) return;
    discovered.set(code, {
      sourceName: "state-directory",
      entryKey: code,
      entityType: "state_or_union_territory",
      name: STATE_AND_UTS[code],
      jurisdiction: STATE_AND_UTS[code],
      parentName: "India",
      officialUrl: null,
      directoryUrl: url,
      metadata: {
        code,
        directorySource: "Integrated Government Online Directory",
      },
    });
  });
  for (const [code, name] of Object.entries(STATE_AND_UTS)) {
    if (discovered.has(code)) continue;
    discovered.set(code, {
      sourceName: "state-directory",
      entryKey: code,
      entityType: "state_or_union_territory",
      name,
      jurisdiction: name,
      parentName: "India",
      officialUrl: null,
      directoryUrl: `https://igod.gov.in/sg/${code}/categories`,
      metadata: {
        code,
        directorySource: "Integrated Government Online Directory",
        baseline: true,
      },
    });
  }
  return [...discovered.values()];
};

const stateDirectoryConnector = {
  name: "state-directory",
  defaultCollection: "states-and-union-territories",
  async collect(options = {}, { fetcher }) {
    try {
      const response = await fetcher.getText(DIRECTORY_URL);
      const directoryEntries = parseStateDirectory(
        response.body,
        DIRECTORY_URL,
      ).slice(0, Math.max(1, Number(options.limit || 100)));
      return {
        records: [],
        directoryEntries,
        snapshots: [
          createSnapshot({
            sourceName: this.name,
            sourceUrl: DIRECTORY_URL,
            body: response.body,
            responseStatus: response.status,
            recordCount: directoryEntries.length,
            metadata: { collection: this.defaultCollection },
          }),
        ],
        errors: [],
        diagnostics: [],
      };
    } catch (error) {
      return {
        records: [],
        directoryEntries: [],
        snapshots: [],
        errors: [{ stage: "directory", message: error.message }],
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

attachConnectorLifecycle(stateDirectoryConnector, [
  "states-and-union-territories",
]);

module.exports = {
  DIRECTORY_URL,
  STATE_AND_UTS,
  parseStateDirectory,
  stateDirectoryConnector,
};
