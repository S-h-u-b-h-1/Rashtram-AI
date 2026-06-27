const {
  createOfficialDirectoryConnector,
} = require("./officialDirectoryConnector");

const rajyaSabhaConnector = createOfficialDirectoryConnector({
  name: "rajya-sabha",
  collection: "rajya-sabha",
  url: "https://sansad.in/rs",
  authority: "Rajya Sabha Secretariat",
  jurisdictionLevel: "union",
  jurisdiction: "India",
});

module.exports = { rajyaSabhaConnector };
