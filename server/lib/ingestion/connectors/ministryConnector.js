const {
  createOfficialDirectoryConnector,
} = require("./officialDirectoryConnector");

const ministryConnector = createOfficialDirectoryConnector({
  name: "ministry",
  collection: "ministries-and-departments",
  url: "https://www.india.gov.in/my-government/whos-who/ministries-departments",
  authority: "Government of India",
  jurisdictionLevel: "union",
  jurisdiction: "India",
});

module.exports = { ministryConnector };
