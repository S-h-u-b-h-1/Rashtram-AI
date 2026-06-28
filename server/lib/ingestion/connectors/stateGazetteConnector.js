const {
  createOfficialDirectoryConnector,
} = require("./officialDirectoryConnector");

const stateGazetteConnector = createOfficialDirectoryConnector({
  name: "state-gazette",
  collection: "official-directory",
  url: "https://egazette.gov.in/GazetteDirectory.aspx",
  authority: "Directorate of Printing, Government of India",
  jurisdictionLevel: "state",
  jurisdiction: "India",
  includeDirectoryLinks: true,
  linkPattern: /(gazette|rajpatra|printing|publication)/i,
  allowedHosts: ["gov.in", "nic.in"],
  directoryDocumentType: "gazette",
  blockedWhenEmpty: true,
  blockedReason:
    "The state-gazette directory uses interactive ASP.NET controls and did not expose a stable crawlable listing.",
});

module.exports = { stateGazetteConnector };
