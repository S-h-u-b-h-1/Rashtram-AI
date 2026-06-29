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
      blockedWhenEmpty: true,
      blockedReason: "The Digital Sansad e-Parliament Library is unreachable due to connection timeouts or access controls.",
    },
    {
      collection: "lok-sabha-questions",
      url: "https://sansad.in/ls/questions/questions-and-answers",
      documentType: "question",
      titleCell: 1,
      identityCells: [0, 2, 3],
      accessMethod: "Digital Sansad server-rendered listing",
      blockedWhenEmpty: true,
      blockedReason: "The Lok Sabha questions page requires client-side JavaScript rendering (Next.js hydration) and cannot be crawled statically.",
    },
    {
      collection: "rajya-sabha-questions",
      url: "https://sansad.in/rs/questions/questions-and-answers",
      documentType: "question",
      titleCell: 1,
      identityCells: [0, 2, 3],
      accessMethod: "Digital Sansad server-rendered listing",
      blockedWhenEmpty: true,
      blockedReason: "The Rajya Sabha questions page requires client-side JavaScript rendering and has malformed HTTP response headers.",
    },
  ],
});

module.exports = { digitalSansadConnector };
