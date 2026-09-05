const test = require("node:test");
const assert = require("node:assert/strict");

const {
  allowExtractiveComparisonFallback,
  comparisonSectionBackfill,
  validateComparisonOutput,
  normalizeRequest,
  readinessReason,
} = require("../document/documentComparisonService");

test("comparison output validator rejects analytically empty success", () => {
  const citations = [{ id: "D1-C1", documentId: "101" }, { id: "D2-C1", documentId: "102" }];
  const empty = validateComparisonOutput({
    generationMode: "ai",
    executiveSummary: "Comparison completed.",
    similarities: [], differences: [], keyFindings: [],
  }, citations);
  assert.equal(empty.valid, false);
  assert.equal(empty.reason, "ANALYTICALLY_EMPTY");
  const useful = validateComparisonOutput({
    generationMode: "ai",
    executiveSummary: "D1 differs from D2 in reporting duties and practical scope [D1-C1] [D2-C1].",
    differences: [{
      topic: "Reporting scope",
      documentA: "D1 applies to periodic reporting.",
      documentB: "D2 does not identify the same reporting duty.",
      significance: "The difference matters for implementation planning.",
      analysis: "D1 differs from D2 because its reporting duty is explicit, whereas D2 does not identify an equivalent duty.",
      citations: ["D1-C1", "D2-C1"],
    }],
  }, citations);
  assert.equal(useful.valid, true);
  assert.equal(useful.status, "SUCCESS");
});

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

test("comparison fallback is enabled by default and can be explicitly disabled", () => {
  const previous = process.env.COMPARISON_ALLOW_EXTRACTIVE_FALLBACK;
  delete process.env.COMPARISON_ALLOW_EXTRACTIVE_FALLBACK;
  assert.equal(allowExtractiveComparisonFallback(), true);

  process.env.COMPARISON_ALLOW_EXTRACTIVE_FALLBACK = "false";
  assert.equal(allowExtractiveComparisonFallback(), false);

  process.env.COMPARISON_ALLOW_EXTRACTIVE_FALLBACK = "true";
  assert.equal(allowExtractiveComparisonFallback(), true);

  if (previous === undefined) {
    delete process.env.COMPARISON_ALLOW_EXTRACTIVE_FALLBACK;
  } else {
    process.env.COMPARISON_ALLOW_EXTRACTIVE_FALLBACK = previous;
  }
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

test("comparison section normalization never promotes raw passages into analysis", () => {
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

  assert.equal(repaired.executiveSummary, "Not identified in the retrieved text.");
  assert.equal(repaired.differences.length, 0);
  assert.equal(repaired.keyClauses.length, 0);
  assert.equal(repaired.sectionStatus.differences, "insufficient_evidence");
  assert.equal(repaired.sectionStatus.timeline, "insufficient_evidence");
  assert.equal(repaired.quality.normalized, true);
});

test("comparison backfill never attributes one document's ministry to every document", () => {
  const documents = [
    {
      id: "201",
      type: "order",
      title: "Details of CPIOs and First Appellate Authorities",
      ministry: null,
      jurisdiction: "India",
    },
    {
      id: "202",
      type: "policy",
      title: "Strategic Roadmap for Making Ayurveda Global",
      ministry: "Ministry of Planning",
      jurisdiction: "India",
    },
  ];
  const groups = documents.map((document, documentIndex) => ({
    document,
    documentIndex,
    passages: [
      {
        content:
          documentIndex === 0
            ? "The National Medical Commission designates Central Public Information Officers and First Appellate Authorities under the Right to Information framework."
            : "The roadmap discusses Ayurveda standards, global markets and international cooperation.",
      },
    ],
  }));
  const citations = groups.map((group) => ({
    id: `D${group.documentIndex + 1}-C1`,
    documentId: group.document.id,
    snippet: group.passages[0].content,
  }));

  const repaired = comparisonSectionBackfill({
    documents,
    groups,
    citations,
    generated: { similarities: [], differences: [] },
  });

  assert.equal(
    repaired.similarities.some((item) =>
      String(item.point).includes("Ministry of Planning"),
    ),
    false,
  );
  assert.equal(
    repaired.similarities.some((item) =>
      String(item.point).includes("same jurisdictional context"),
    ),
    false,
  );
  assert.equal(repaired.differences.length, 0);
  assert.equal(repaired.sectionStatus.differences, "insufficient_evidence");
});

test("comparison validator requires cross-document cited synthesis", () => {
  const citations = [
    { id: "D1-C1", documentId: "101", snippet: "D1 requires a monthly report." },
    { id: "D2-C1", documentId: "102", snippet: "D2 describes an annual review." },
  ];
  const extractive = validateComparisonOutput({
    generationMode: "ai",
    executiveSummary: "D1 requires a monthly report. D2 describes an annual review. [D1-C1] [D2-C1]",
    differences: [
      { topic: "Reporting", analysis: "D1 requires a monthly report.", citations: ["D1-C1"] },
      { topic: "Review", analysis: "D2 describes an annual review.", citations: ["D2-C1"] },
    ],
  }, citations);
  assert.equal(extractive.valid, false);
  assert.equal(extractive.reason, "NON_COMPARATIVE_ANALYSIS");

  const synthesized = validateComparisonOutput({
    generationMode: "ai",
    executiveSummary: "D1 requires monthly reporting whereas D2 uses an annual review, changing the operational cadence [D1-C1] [D2-C1].",
    differences: [{
      topic: "Reporting cadence",
      documentA: "D1 requires monthly reporting.",
      documentB: "D2 uses an annual review.",
      significance: "The different cadence changes the control calendar for affected operators.",
      analysis: "D1 differs from D2 in reporting cadence: monthly controls are required under D1, whereas D2 identifies an annual review.",
      citations: ["D1-C1", "D2-C1"],
    }],
  }, citations);
  assert.equal(synthesized.valid, true);
  assert.equal(synthesized.status, "SUCCESS");
  assert.deepEqual(synthesized.representedDocuments.sort(), ["101", "102"]);
});

test("comparison validator rejects citation-free and extractive-only success", () => {
  const citations = [
    { id: "D1-C1", documentId: "101", snippet: "D1 sets a permit requirement." },
    { id: "D2-C1", documentId: "102", snippet: "D2 sets a reporting requirement." },
  ];
  const uncited = validateComparisonOutput({
    generationMode: "ai",
    executiveSummary: "D1 differs from D2 in implementation [D1-C1] [D2-C1].",
    differences: [{
      topic: "Implementation",
      analysis: "D1 differs from D2 in the way the requirement is implemented.",
      citations: [],
    }, {
      topic: "Reporting",
      analysis: "D1 differs from D2 in reporting cadence, which changes the control calendar.",
      citations: ["D1-C1", "D2-C1"],
    }],
  }, citations);
  assert.equal(uncited.valid, false);
  assert.equal(uncited.reason, "UNCITED_ANALYSIS");
});

test("comparison validator rejects citation labels that are not in the evidence set", () => {
  const result = validateComparisonOutput({
    generationMode: "ai",
    executiveSummary: "Document A differs from Document B in reporting scope [D1-C9] [D2-C1].",
    differences: [{
      topic: "Reporting scope",
      documentA: "Document A requires monthly reporting.",
      documentB: "Document B identifies an annual review.",
      significance: "The difference changes the operating calendar.",
      citations: ["D1-C1", "D2-C1"],
    }],
  }, [
    { id: "D1-C1", documentId: "101", snippet: "Document A requires monthly reporting." },
    { id: "D2-C1", documentId: "102", snippet: "Document B identifies an annual review." },
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "INVALID_SUMMARY_CITATION");
});
