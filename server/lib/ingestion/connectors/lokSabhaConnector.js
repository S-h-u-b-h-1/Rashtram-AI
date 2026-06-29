const {
  createParliamentPortalConnector,
} = require("./parliamentPortalConnector");

const lokSabhaConnector = createParliamentPortalConnector({
  name: "lok-sabha",
  authority: "Lok Sabha Secretariat",
  defaultCollection: "questions",
  pages: [
    {
      collection: "questions",
      url: "https://sansad.in/ls/questions/questions-and-answers",
      documentType: "question",
      titleCell: 1,
      identityCells: [0, 2, 3],
      ministryCell: 5,
      accessMethod: "Digital Sansad server-rendered listing",
      blockedWhenEmpty: true,
      blockedReason: "The Lok Sabha questions page requires client-side JavaScript rendering (Next.js hydration) and cannot be crawled statically.",
    },
    {
      collection: "debates",
      url: "https://eparlib.sansad.in/handle/123456789/7",
      documentType: "debate",
      titleCell: 1,
      pagination: "offset",
      pageSize: 20,
      accessMethod: "Parliament Digital Library HTML catalogue",
      blockedWhenEmpty: true,
      blockedReason: "The Parliament Digital Library debates listing is unreachable due to connection timeouts.",
    },
    {
      collection: "bulletin-i",
      url: "https://eparlib.sansad.in/handle/123456789/795919",
      documentType: "proceeding",
      titleCell: 1,
      pagination: "offset",
      pageSize: 20,
      accessMethod: "Parliament Digital Library HTML catalogue",
      blockedWhenEmpty: true,
      blockedReason: "The Parliament Digital Library bulletin-i listing is unreachable due to connection timeouts.",
    },
    {
      collection: "bulletin-ii",
      url: "https://eparlib.sansad.in/handle/123456789/1933333",
      documentType: "proceeding",
      titleCell: 1,
      pagination: "offset",
      pageSize: 20,
      accessMethod: "Parliament Digital Library HTML catalogue",
      blockedWhenEmpty: true,
      blockedReason: "The Parliament Digital Library bulletin-ii listing is unreachable due to connection timeouts.",
    },
    {
      collection: "business",
      url: "https://sansad.in/ls/business",
      documentType: "proceeding",
      rowPattern: /(list of business|bulletin|papers laid|calendar)/i,
      accessMethod: "Digital Sansad server-rendered listing",
      blockedWhenEmpty: true,
      blockedReason:
        "The current business page exposes descriptions but its document listing requires interactive filters.",
    },
  ],
});

module.exports = { lokSabhaConnector };
