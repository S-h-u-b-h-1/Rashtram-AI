const {
  createParliamentPortalConnector,
} = require("./parliamentPortalConnector");

const digitalSansadConnector = createParliamentPortalConnector({
  name: "digital-sansad",
  authority: "Parliament of India",
  defaultCollection: "committee-reports",
  pages: [
    {
      collection: "committee-reports",
      url: "https://eparlib.sansad.in/handle/123456789/13",
      documentType: "committee_report",
      titleCell: 1,
      pagination: "offset",
      pageSize: 20,
      accessMethod: "Parliament Digital Library HTML catalogue",
    },
    {
      collection: "lok-sabha-questions",
      url: "https://sansad.in/ls/questions/questions-and-answers",
      documentType: "question",
      titleCell: 1,
      identityCells: [0, 2, 3],
      ministryCell: 5,
      accessMethod: "Digital Sansad server-rendered listing",
    },
    {
      collection: "rajya-sabha-questions",
      url: "https://sansad.in/rs/questions/questions-and-answers",
      documentType: "question",
      titleCell: 1,
      identityCells: [0, 2, 3],
      ministryCell: 5,
      accessMethod: "Digital Sansad server-rendered listing",
    },
  ],
});

module.exports = { digitalSansadConnector };
