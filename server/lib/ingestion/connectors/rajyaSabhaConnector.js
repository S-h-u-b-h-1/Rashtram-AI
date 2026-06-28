const {
  createParliamentPortalConnector,
} = require("./parliamentPortalConnector");

const rajyaSabhaConnector = createParliamentPortalConnector({
  name: "rajya-sabha",
  authority: "Rajya Sabha Secretariat",
  defaultCollection: "questions",
  pages: [
    {
      collection: "questions",
      url: "https://sansad.in/rs/questions/questions-and-answers",
      documentType: "question",
      titleCell: 1,
      identityCells: [0, 2, 3],
      ministryCell: 5,
      accessMethod: "Digital Sansad server-rendered listing",
    },
    {
      collection: "committee-meetings",
      url: "https://sansad.in/rs/committees/committee-meetings",
      documentType: "proceeding",
      titleCell: 0,
      identityCells: [0, 1, 2],
      statusCell: 5,
      titlePrefix: "Committee meeting",
      accessMethod: "Digital Sansad server-rendered listing",
    },
    {
      collection: "official-debates",
      url: "https://sansad.in/rs/debates/officials",
      documentType: "debate",
      accessMethod: "Digital Sansad server-rendered listing",
      blockedWhenEmpty: true,
      blockedReason:
        "Official debate files require interactive session and date filters; the connector does not bypass those controls.",
    },
  ],
});

module.exports = { rajyaSabhaConnector };
