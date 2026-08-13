const test = require("node:test");
const assert = require("node:assert/strict");

const {
  comparisonSectionBackfill,
  normalizeRequest,
  readinessReason,
} = require("../document/documentComparisonService");

test("comparison accepts two to five unique documents", () => {
  assert.deepEqual(
    normalizeRequest({
      documentIds: ["11", "12"],
      comparisonMode: "clause",
      language: "hindi",
      userQuestion: "How do the duties differ?",
    }),
    {
      documentIds: ["11", "12"],
      mode: "clause",
      language: "hindi",
      userQuestion: "How do the duties differ?",
    },
  );
  assert.equal(
    normalizeRequest({ documentIds: ["1", "2", "3", "4", "5"] })
      .documentIds.length,
    5,
  );
});

test("comparison rejects invalid counts, duplicates, modes and languages", () => {
  assert.throws(
    () => normalizeRequest({ documentIds: ["1"] }),
    /between two and five/i,
  );
  assert.throws(
    () => normalizeRequest({ documentIds: ["1", "1"] }),
    /duplicate/i,
  );
  assert.throws(
    () =>
      normalizeRequest({
        documentIds: ["1", "2"],
        mode: "invented",
      }),
    /unsupported comparison mode/i,
  );
  assert.throws(
    () =>
      normalizeRequest({
        documentIds: ["1", "2"],
        language: "French",
      }),
    /unsupported comparison language/i,
  );
});

test("comparison readiness exposes specific disabled reasons", () => {
  assert.equal(readinessReason(null), "Document not found");
  assert.equal(
    readinessReason({ processingStatus: "failed" }),
    "Processing failed",
  );
  assert.equal(
    readinessReason({ processingStatus: null, pdfUrl: null }),
    "Research workspace unavailable",
  );
  assert.equal(
    readinessReason({
      id: "1",
      title: "Bill",
      pdfUrl: "https://example.test/a.pdf",
      researchReady: false,
    }),
    "Research workspace unavailable",
  );
  assert.equal(
    readinessReason({
      id: "1",
      title: "Bill",
      pdfUrl: "https://example.test/a.pdf",
      researchReady: true,
      comparisonReady: true,
      processingStatus: "ready",
      extractionStatus: "ready",
      embeddingStatus: "ready",
      chunksCount: 3,
      embeddingsCount: 3,
    }),
    null,
  );
  assert.equal(
    readinessReason({
      id: "1",
      title: "Bill",
      pdfUrl: "https://example.test/a.pdf",
      researchReady: true,
      comparisonReady: true,
      processingStatus: "ready",
      extractionStatus: "ready",
      embeddingStatus: "fallback",
      chunksCount: 3,
      embeddingsCount: 0,
      retrievalMode: "local_text",
      retrievalVerified: true,
    }),
    null,
  );
  assert.equal(
    readinessReason({
      id: "1",
      title: "Bill",
      pdfUrl: "https://example.test/a.pdf",
      researchReady: true,
      comparisonReady: false,
      readinessReason: "Retrieval verification is pending.",
      processingStatus: "ready",
      extractionStatus: "ready",
      embeddingStatus: "ready",
      chunksCount: 3,
      embeddingsCount: 3,
    }),
    "Retrieval verification is pending.",
  );
});

test("comparison accepts the public API contract and legacy aliases", () => {
  assert.deepEqual(
    normalizeRequest({
      documentIds: [1, 2],
      comparisonMode: "compliance",
      language: "auto",
    }),
    {
      documentIds: ["1", "2"],
      mode: "compliance",
      language: "auto",
      userQuestion: "",
    },
  );
  assert.equal(
    normalizeRequest({
      documentIds: [1, 2],
      mode: "comprehensive",
      language: "English",
    }).mode,
    "full",
  );
});

test("comparison readiness distinguishes pending and unusable text", () => {
  assert.equal(
    readinessReason({
      id: "1",
      title: "Policy",
      pdfUrl: "https://example.test/policy.pdf",
      processingStatus: "ready",
      extractionStatus: "pending",
    }),
    "Text extraction pending",
  );
  assert.equal(
    readinessReason({
      id: "1",
      title: "Policy",
      pdfUrl: "https://example.test/policy.pdf",
      processingStatus: "ready",
      extractionStatus: "ready",
      chunksCount: 0,
    }),
    "No extractable text found",
  );
});

test("comparison section backfill fills sparse AI output from cited passages", () => {
  const documents = [
    {
      id: "101",
      type: "bill",
      title: "The Manipur Goods and Services Tax (Amendment) Bill, 2025",
      ministry: "Finance",
      jurisdiction: "India",
      year: 2025,
      publicationDate: "2025-07-31",
    },
    {
      id: "102",
      type: "bill",
      title: "The Manipur Goods and Services Tax (Second Amendment) Bill, 2025",
      ministry: "Finance",
      jurisdiction: "India",
      year: 2025,
      publicationDate: "2025-11-27",
    },
  ];
  const groups = [
    {
      document: documents[0],
      documentIndex: 0,
      passages: [
        {
          content:
            "The Bill seeks to amend section 9 to levy State tax on un-denatured extra neutral alcohol or rectified spirit used for manufacture of alcoholic liquor for human consumption.",
        },
        {
          content:
            "The taxable person may pay tax with interest and penalty within sixty days of issue of notice, and proceedings shall be deemed to be concluded. The proper officer shall act on such payment.",
        },
      ],
    },
    {
      document: documents[1],
      documentIndex: 1,
      passages: [
        {
          content:
            "The Government may provide a system for affixation of unique identification marking and electronic storage and access of information for track and trace of certain goods.",
        },
        {
          content:
            "The Financial Memorandum states that the Bill will not involve expenditure from the Consolidated Fund of the State of Manipur. It was dated the 27th November, 2025.",
        },
      ],
    },
  ];
  const citations = groups.flatMap((group) =>
    group.passages.map((passage, passageIndex) => ({
      id: `D${group.documentIndex + 1}-C${passageIndex + 1}`,
      documentId: group.document.id,
      snippet: passage.content,
    })),
  );

  const repaired = comparisonSectionBackfill({
    documents,
    groups,
    citations,
    generated: {
      executiveSummary: "Not identified in the retrieved text.",
      similarities: [],
      differences: [],
      stakeholders: [],
      complianceImpact: [],
      timeline: [],
      authorityDifferences: [],
      impactAssessment: [],
      keyFindings: [],
    },
  });

  assert.ok(repaired.executiveSummary.includes("D1"));
  assert.ok(repaired.similarities.length >= 2);
  assert.ok(repaired.differences.length >= 2);
  assert.ok(repaired.keyClauses.length >= 2);
  assert.ok(repaired.stakeholders.length >= 2);
  assert.ok(repaired.complianceImpact.length >= 2);
  assert.ok(repaired.timeline.length >= 2);
  assert.ok(repaired.authorityDifferences.length >= 2);
  assert.ok(repaired.impactAssessment.length >= 2);
  assert.ok(repaired.keyFindings.length >= 1);
  assert.ok(
    repaired.stakeholders.every((item) => Array.isArray(item.citations)),
  );
  assert.ok(repaired.quality.backfilled);
});
