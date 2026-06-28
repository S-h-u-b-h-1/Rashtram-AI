const {
  createOfficialDirectoryConnector,
} = require("./officialDirectoryConnector");

const ministryConnector = createOfficialDirectoryConnector({
  name: "ministry",
  collection: "ministries-and-departments",
  url: "https://www.india.gov.in/directory/web-directory",
  authority: "Government of India",
  jurisdictionLevel: "union",
  jurisdiction: "India",
  includeDirectoryLinks: true,
  linkPattern: /(ministry|department)/i,
  allowedHosts: ["gov.in", "nic.in"],
  directoryDocumentType: "other",
  blockedWhenEmpty: true,
  blockedReason:
    "The official directory loads ministry entries interactively and did not expose crawlable links in this response.",
});

module.exports = { ministryConnector };
