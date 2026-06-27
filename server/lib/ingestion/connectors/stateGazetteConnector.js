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
});

module.exports = { stateGazetteConnector };
