const {
  createOfficialDirectoryConnector,
} = require("./officialDirectoryConnector");

const digitalSansadConnector = createOfficialDirectoryConnector({
  name: "digital-sansad",
  collection: "parliament",
  url: "https://sansad.in/",
  authority: "Parliament of India",
  jurisdictionLevel: "union",
  jurisdiction: "India",
});

module.exports = { digitalSansadConnector };
