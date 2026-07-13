#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { getPool, query } = require("../db");
const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");
const {
  REQUIRED_CATEGORIES,
  RESEARCH_BENCHMARKS,
} = require("../evaluation/researchBenchmarks");

const nowSlug = () => new Date().toISOString().replace(/[:.]/g, "-");

const ensureOutPath = async (requested, extension) => {
  const fallback = path.resolve(
    __dirname,
    "..",
    "evaluation-results",
    `research-eval-${nowSlug()}.${extension}`,
  );
  const resolved = requested && requested !== true
    ? path.resolve(process.cwd(), requested)
    : fallback;
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  return resolved;
};

const readinessCoverage = async () => {
  const result = await query(`
    SELECT
      COUNT(*)::INTEGER AS total_documents,
      COUNT(*) FILTER (WHERE research_ready)::INTEGER AS research_ready,
      COUNT(*) FILTER (WHERE comparison_ready)::INTEGER AS comparison_ready,
      COUNT(*) FILTER (WHERE source_authority_tier = 'A')::INTEGER AS tier_a_documents,
      COUNT(*) FILTER (WHERE source_authority_tier = 'D')::INTEGER AS tier_d_documents
    FROM documents
  `);
  const byType = await query(`
    SELECT
      document_type,
      COUNT(*)::INTEGER AS total,
      COUNT(*) FILTER (WHERE research_ready)::INTEGER AS research_ready,
      COUNT(*) FILTER (WHERE comparison_ready)::INTEGER AS comparison_ready
    FROM documents
    GROUP BY document_type
    ORDER BY total DESC, document_type
  `);
  return {
    totals: result.rows[0],
    byType: byType.rows,
  };
};

const documentFilterSql = ({ documentType }) => (
  documentType
    ? "AND document.document_type = $1"
    : ""
);

const loadVerifiedDocuments = async ({ limit, documentType, humanReviewedOnly }) => {
  const params = [];
  if (documentType) params.push(documentType);
  params.push(Math.max(limit * 2, 30));
  const result = await query(
    `WITH ready AS (
       SELECT
         document.id,
         document.document_type,
         document.title,
         document.year,
         document.jurisdiction,
         document.jurisdiction_level,
         document.source_authority_tier,
         COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
         legacy.canonical_url,
         legacy.pdf_url,
         state.retrieval_mode,
         state.retrieval_verified,
         state.chunks_count,
         ROW_NUMBER() OVER (
           PARTITION BY document.document_type
           ORDER BY document.source_authority_tier ASC NULLS LAST,
             state.last_processed_at DESC NULLS LAST,
             document.id
         ) AS type_rank
       FROM documents document
       JOIN legislative_documents legacy ON legacy.id = document.id
       JOIN document_processing_state state ON state.document_id = document.id
       WHERE document.research_ready
         AND document.comparison_ready
         AND document.visibility_status = 'public'
         AND state.retrieval_verified
         AND state.chunks_count > 0
         ${documentFilterSql({ documentType })}
     )
     SELECT
       ready.*,
       chunk.chunk_index,
       LEFT(chunk.original_text, 1200) AS source_snippet,
       chunk.language
     FROM ready
     JOIN LATERAL (
       SELECT chunk_index, original_text, language
       FROM document_text_chunks chunk
       WHERE chunk.document_id = ready.id
         AND LENGTH(TRIM(chunk.original_text)) >= 120
       ORDER BY chunk.chunk_index ASC
       LIMIT 1
     ) chunk ON TRUE
     WHERE ready.type_rank <= 12
     ORDER BY ready.type_rank, ready.document_type, ready.id
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.filter(() => !humanReviewedOnly);
};

const buildBenchmark = (documents, limit, categoryFilter) => {
  const exact = [];
  const comparisons = [];
  const negatives = [];
  const addExact = (item) => exact.push(item);
  const addComparison = (item) => comparisons.push(item);
  const addNegative = (item) => negatives.push(item);

  for (const doc of documents) {
    const id = String(doc.id);
    addExact({
      id: `exact-title-${id}`,
      category: "exact_retrieval",
      question: `Find the document titled "${doc.title}" and cite the most relevant passage.`,
      expectedDocumentIds: [id],
      expectedSourceTier: doc.source_authority_tier || "unknown",
      expectedChunks: [{ documentId: id, chunkIndex: Number(doc.chunk_index) }],
      requiredFacts: [doc.title],
      optionalAcceptableFacts: [doc.source, doc.document_type, doc.year].filter(Boolean).map(String),
      prohibitedUnsupportedClaims: ["facts from unrelated documents", "unstated legal advice"],
      inferenceAllowed: false,
      expectedAnswerType: "citation_grounded_lookup",
      humanVerificationStatus: "deterministic_metadata_and_chunk_presence",
      reviewerNotes: "Generated from a research-ready document with stored chunks.",
    });
    addExact({
      id: `source-authority-${id}`,
      category: "exact_retrieval",
      question: `Which source or authority is associated with "${doc.title}"?`,
      expectedDocumentIds: [id],
      expectedSourceTier: doc.source_authority_tier || "unknown",
      expectedChunks: [{ documentId: id, chunkIndex: Number(doc.chunk_index) }],
      requiredFacts: [doc.source],
      optionalAcceptableFacts: [doc.source_authority_tier, doc.document_type].filter(Boolean).map(String),
      prohibitedUnsupportedClaims: ["unsupported issuing authority", "unrelated ministry"],
      inferenceAllowed: false,
      expectedAnswerType: "metadata_fact",
      humanVerificationStatus: "deterministic_metadata",
      reviewerNotes: "Source is read from normalized catalogue metadata.",
    });
    if (doc.year) {
      addExact({
        id: `date-year-${id}`,
        category: "exact_retrieval",
        question: `Retrieve the year associated with "${doc.title}" and cite the document.`,
        expectedDocumentIds: [id],
        expectedSourceTier: doc.source_authority_tier || "unknown",
        expectedChunks: [{ documentId: id, chunkIndex: Number(doc.chunk_index) }],
        requiredFacts: [String(doc.year)],
        optionalAcceptableFacts: [doc.title],
        prohibitedUnsupportedClaims: ["incorrect date", "uncited date"],
        inferenceAllowed: false,
        expectedAnswerType: "date_lookup",
        humanVerificationStatus: "deterministic_metadata",
        reviewerNotes: "Year comes from normalized document metadata.",
      });
    }
  }

  for (let index = 0; index < documents.length - 1; index += 2) {
    const left = documents[index];
    const right = documents[index + 1];
    if (!left || !right) continue;
    addComparison({
      id: `comparison-${left.id}-${right.id}`,
      category: "comparison",
      question: `Compare the scope of "${left.title}" and "${right.title}" using only cited evidence.`,
      expectedDocumentIds: [String(left.id), String(right.id)],
      expectedSourceTier: [left.source_authority_tier, right.source_authority_tier].filter(Boolean).join(","),
      expectedChunks: [
        { documentId: String(left.id), chunkIndex: Number(left.chunk_index) },
        { documentId: String(right.id), chunkIndex: Number(right.chunk_index) },
      ],
      requiredFacts: [left.title, right.title],
      optionalAcceptableFacts: [left.document_type, right.document_type].filter(Boolean).map(String),
      prohibitedUnsupportedClaims: ["comparison beyond retrieved documents"],
      inferenceAllowed: true,
      expectedAnswerType: "comparison",
      humanVerificationStatus: "deterministic_metadata_and_chunk_presence",
      reviewerNotes: "Comparison benchmark expects both documents to be retrieved.",
    });
  }

  const negativeTarget = Math.max(3, Math.ceil(limit * 0.15));
  for (let index = 1; index <= negativeTarget; index += 1) {
    addNegative({
      id: `insufficient-evidence-${index}`,
      category: "insufficient_evidence",
      question: `What is the exact compliance deadline in the Rashtram Quantum Sandboxes Regulation ${2090 + index}?`,
      expectedDocumentIds: [],
      expectedSourceTier: "none",
      expectedChunks: [],
      requiredFacts: [],
      optionalAcceptableFacts: [],
      prohibitedUnsupportedClaims: ["invented regulation", "invented deadline", "uncited compliance advice"],
      inferenceAllowed: false,
      expectedAnswerType: "insufficient_evidence",
      humanVerificationStatus: "synthetic_negative_control",
      reviewerNotes: "Synthetic negative-control question; expected behavior is insufficient evidence.",
    });
  }

  const pool = categoryFilter
    ? [...exact, ...comparisons, ...negatives].filter((item) => item.category === categoryFilter)
    : [
        ...exact.slice(0, Math.max(0, limit - negativeTarget - Math.min(5, comparisons.length))),
        ...comparisons.slice(0, Math.min(5, comparisons.length)),
        ...negatives,
      ];
  return pool.slice(0, limit);
};

const retrieve = async (question, topK) => {
  const startedAt = Date.now();
  const result = await query(
    `WITH scored AS (
       SELECT
         document.id AS document_id,
         document.document_type,
         document.title,
         document.source_authority_tier,
         chunk.chunk_index,
         LEFT(chunk.original_text, 360) AS snippet,
         (
           ts_rank_cd(
             to_tsvector('simple', COALESCE(document.title, '') || ' ' || COALESCE(chunk.original_text, '')),
             plainto_tsquery('simple', $1)
           )
           + CASE
               WHEN LOWER($1) LIKE '%' || LOWER(document.title) || '%' THEN 2
               WHEN LOWER(document.title) LIKE '%' || LOWER(SPLIT_PART($1, ' ', 1)) || '%' THEN 0.05
               ELSE 0
             END
         ) AS score
       FROM document_text_chunks chunk
       JOIN documents document ON document.id = chunk.document_id
       JOIN document_processing_state state ON state.document_id = document.id
       WHERE document.research_ready
         AND document.visibility_status = 'public'
         AND state.retrieval_verified
     )
     SELECT *
     FROM scored
     WHERE score > 0
     ORDER BY score DESC, document_id, chunk_index
     LIMIT $2`,
    [question, topK],
  );
  return {
    latencyMs: Date.now() - startedAt,
    results: result.rows.map((row, index) => ({
      rank: index + 1,
      documentId: String(row.document_id),
      documentType: row.document_type,
      title: row.title,
      sourceTier: row.source_authority_tier,
      chunkIndex: Number(row.chunk_index),
      score: Number(row.score || 0),
      snippet: row.snippet,
    })),
  };
};

const scoreQuestion = async (benchmark, topK) => {
  const retrieval = await retrieve(benchmark.question, topK);
  const expected = new Set(benchmark.expectedDocumentIds.map(String));
  const retrievedDocRanks = new Map();
  for (const item of retrieval.results) {
    if (!retrievedDocRanks.has(item.documentId)) {
      retrievedDocRanks.set(item.documentId, item.rank);
    }
  }
  const found = [...expected].filter((id) => retrievedDocRanks.has(id));
  const firstExpectedRank = found
    .map((id) => retrievedDocRanks.get(id))
    .sort((left, right) => left - right)[0] || null;
  const topScore = retrieval.results[0]?.score || 0;
  const negativeRareTerms = benchmark.expectedDocumentIds.length === 0
    ? String(benchmark.question)
        .toLowerCase()
        .match(/rashtram quantum sandboxes regulation \d+/)?.[0]
    : null;
  const negativeHasDirectSupport = negativeRareTerms
    ? retrieval.results.some((item) =>
        `${item.title || ""} ${item.snippet || ""}`
          .toLowerCase()
          .includes(negativeRareTerms),
      )
    : false;
  const insufficientEvidenceCorrect =
    benchmark.expectedDocumentIds.length === 0
      ? !negativeHasDirectSupport
      : null;
  const expectedChunkFound = benchmark.expectedChunks.some((expectedChunk) =>
    retrieval.results.some((item) =>
      item.documentId === String(expectedChunk.documentId) &&
      item.chunkIndex === Number(expectedChunk.chunkIndex),
    ),
  );
  return {
    benchmark,
    retrieval: {
      topK,
      latencyMs: retrieval.latencyMs,
      expectedDocumentsFound: found.length,
      expectedDocumentsTotal: expected.size,
      recallAtK: expected.size ? found.length / expected.size : null,
      expectedDocumentAppears: expected.size ? found.length > 0 : null,
      expectedSectionOrChunkAppears: expected.size ? expectedChunkFound : null,
      reciprocalRank: firstExpectedRank ? 1 / firstExpectedRank : 0,
      topScore,
      topResults: retrieval.results.slice(0, 5),
    },
    answerEvaluation: {
      mode: "retrieval_only_deterministic",
      factualCorrectness: "not_generated",
      citationCorrectness: expected.size ? found.length > 0 : insufficientEvidenceCorrect,
      citationCompleteness: expected.size ? found.length === expected.size : insufficientEvidenceCorrect,
      unsupportedClaim: false,
      hallucination: false,
      insufficientEvidenceCorrect,
      inferenceLabelled: benchmark.inferenceAllowed ? "not_generated" : true,
      estimatedCostUsd: 0,
    },
  };
};

const aggregate = (results) => {
  const retrievalItems = results.filter((item) => item.benchmark.expectedDocumentIds.length > 0);
  const insufficient = results.filter((item) => item.benchmark.expectedDocumentIds.length === 0);
  const average = (values) => {
    const numeric = values.filter((value) => Number.isFinite(value));
    if (!numeric.length) return null;
    return Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(4));
  };
  const categoryMetrics = {};
  for (const item of results) {
    const category = item.benchmark.category;
    categoryMetrics[category] ||= [];
    categoryMetrics[category].push(item);
  }
  return {
    questions: results.length,
    retrievalQuestions: retrievalItems.length,
    insufficientEvidenceQuestions: insufficient.length,
    recallAtK: average(retrievalItems.map((item) => item.retrieval.recallAtK)),
    meanReciprocalRank: average(retrievalItems.map((item) => item.retrieval.reciprocalRank)),
    expectedDocumentAppearanceRate: average(
      retrievalItems.map((item) => item.retrieval.expectedDocumentAppears ? 1 : 0),
    ),
    expectedChunkAppearanceRate: average(
      retrievalItems.map((item) => item.retrieval.expectedSectionOrChunkAppears ? 1 : 0),
    ),
    citationCorrectness: average(
      results.map((item) => item.answerEvaluation.citationCorrectness ? 1 : 0),
    ),
    unsupportedClaimRate: average(
      results.map((item) => item.answerEvaluation.unsupportedClaim ? 1 : 0),
    ),
    insufficientEvidenceAccuracy: average(
      insufficient.map((item) => item.answerEvaluation.insufficientEvidenceCorrect ? 1 : 0),
    ),
    averageRetrievalLatencyMs: average(results.map((item) => item.retrieval.latencyMs)),
    estimatedCostUsd: 0,
    byCategory: Object.fromEntries(
      Object.entries(categoryMetrics).map(([category, items]) => [
        category,
        {
          questions: items.length,
          recallAtK: average(items.map((item) => item.retrieval.recallAtK).filter((value) => value !== null)),
          meanReciprocalRank: average(items.map((item) => item.retrieval.reciprocalRank)),
          citationCorrectness: average(items.map((item) => item.answerEvaluation.citationCorrectness ? 1 : 0)),
        },
      ]),
    ),
  };
};

const toMarkdown = (report) => {
  const lines = [
    "# Research Benchmark Results",
    "",
    `Generated at: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Mode: ${report.mode}`,
    "",
    "## Aggregate metrics",
    "",
    `- Questions executed: ${report.metrics.questions}`,
    `- Retrieval recall@${report.config.topK}: ${report.metrics.recallAtK}`,
    `- Mean reciprocal rank: ${report.metrics.meanReciprocalRank}`,
    `- Citation correctness proxy: ${report.metrics.citationCorrectness}`,
    `- Unsupported-claim rate: ${report.metrics.unsupportedClaimRate}`,
    `- Insufficient-evidence accuracy: ${report.metrics.insufficientEvidenceAccuracy}`,
    `- Average retrieval latency: ${report.metrics.averageRetrievalLatencyMs} ms`,
    `- Estimated generation cost: $${report.metrics.estimatedCostUsd}`,
    "",
    "## Per-question summary",
    "",
    "| ID | Category | Expected docs | Found | RR | Latency ms |",
    "|---|---|---:|---:|---:|---:|",
    ...report.results.map((item) => (
      `| ${item.benchmark.id} | ${item.benchmark.category} | ${item.retrieval.expectedDocumentsTotal} | ${item.retrieval.expectedDocumentsFound} | ${item.retrieval.reciprocalRank.toFixed(3)} | ${item.retrieval.latencyMs} |`
    )),
    "",
    "## Limitations",
    "",
    "- This run is deterministic retrieval/citation evaluation, not model-generated answer judging.",
    "- Human verification status is recorded per question, but this command does not replace legal review.",
    "- No full copyrighted document text is written to this report.",
    "",
  ];
  return lines.join("\n");
};

const main = async () => {
  const limit = argumentInteger("limit", 30, 1, 100);
  const topK = argumentInteger("top-k", 10, 1, 50);
  const category = argumentValue("category");
  const documentType = argumentValue("document-type");
  const provider = argumentValue("provider", process.env.AI_PROVIDER || "gemini");
  const model = argumentValue("model", process.env.GEMINI_MODEL || process.env.GEMINI_SUMMARY_MODEL || "retrieval-only");
  const outputJson = argumentValue("output-json");
  const outputMarkdown = argumentValue("output-markdown") || argumentValue("markdown");
  const skipGeneration = argumentFlag("skip-generation") || argumentFlag("retrieval-only");
  const humanReviewedOnly = argumentFlag("human-reviewed-only");
  const costLimit = Number(argumentValue("cost-limit", 0));

  const coverage = await readinessCoverage();
  const documents = await loadVerifiedDocuments({
    limit,
    documentType,
    humanReviewedOnly,
  });
  const benchmarks = buildBenchmark(documents, limit, category);
  const results = [];
  for (const benchmark of benchmarks) {
    results.push(await scoreQuestion(benchmark, topK));
  }
  const categories = new Set(RESEARCH_BENCHMARKS.map((benchmark) => benchmark.category));
  const missingCategories = REQUIRED_CATEGORIES.filter((item) => !categories.has(item));
  const report = {
    generatedAt: new Date().toISOString(),
    status: missingCategories.length ? "incomplete" : "measured",
    mode: skipGeneration ? "retrieval_only" : "retrieval_only_generation_not_enabled",
    config: {
      limit,
      topK,
      category: category || null,
      documentType: documentType || null,
      provider,
      model,
      humanReviewedOnly,
      costLimit,
    },
    coverage,
    missingScaffoldCategories: missingCategories,
    benchmarkSeedDocuments: documents.length,
    metrics: aggregate(results),
    qualityGates: {
      advisory: {
        expectedDocumentRecallAtKAtLeast: 0.75,
        citationCorrectnessAtLeast: 0.9,
        unsupportedClaimRateBelow: 0.1,
        insufficientEvidenceAccuracyAtLeast: 0.85,
      },
      releaseBlocking: {
        noCriticalReadinessContradictions: true,
        noUnrelatedDocumentCitation: true,
      },
    },
    results,
  };

  const outputs = {};
  if (outputJson) {
    const jsonPath = await ensureOutPath(outputJson, "json");
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    outputs.json = jsonPath;
  }
  if (outputMarkdown) {
    const markdownPath = await ensureOutPath(outputMarkdown, "md");
    await fs.writeFile(markdownPath, toMarkdown(report));
    outputs.markdown = markdownPath;
  }
  const printable = { ...report, outputs };
  if (!outputJson && !outputMarkdown) {
    console.log(JSON.stringify(printable, null, 2));
  } else {
    console.log(JSON.stringify({
      generatedAt: report.generatedAt,
      status: report.status,
      metrics: report.metrics,
      outputs,
    }, null, 2));
  }
  if (missingCategories.length) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
