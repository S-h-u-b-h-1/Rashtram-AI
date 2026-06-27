const {
  createOfficialDirectoryConnector,
} = require("./officialDirectoryConnector");

const lokSabhaConnector = createOfficialDirectoryConnector({
  name: "lok-sabha",
  collection: "lok-sabha",
  url: "https://sansad.in/ls",
  authority: "Lok Sabha Secretariat",
  jurisdictionLevel: "union",
  jurisdiction: "India",
});

module.exports = { lokSabhaConnector };
