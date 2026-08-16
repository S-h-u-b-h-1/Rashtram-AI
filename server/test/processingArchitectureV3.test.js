const test = require("node:test");
const assert = require("node:assert/strict");

const {
  effectiveBatchSize,
  runCapacityBoundedGroups,
} = require("../document/processingWorkerService");
const {
  PROCESSOR_VERSION,
  deriveCapabilities,
  pendingStages,
  shouldReuseStage,
  stageForPipelineFailure,
} = require("../document/processingStageService");
const { PDFProcessor } = require("../lib/pdfProcessor");

const storage = (safeBatchSize, allowed = safeBatchSize > 0) => ({
  safeBatchSize,
  bulkProcessingAllowed: allowed,
  usagePercent: 70,
  reason: allowed ? null : "capacity exhausted",
});

test("requested processing batch is capped by the safe batch", () => {
  assert.equal(effectiveBatchSize({ requested: 75, safe: 25 }), 25);
});

test("requested processing batch remains smaller than the safe batch", () => {
  assert.equal(effectiveBatchSize({ requested: 10, safe: 25 }), 10);
});

test("capacity is rechecked between bounded worker groups", async () => {
  const limits = [];
  const readings = [storage(2), storage(0, false), storage(0, false)];
  const result = await runCapacityBoundedGroups({
    requested: 10,
    initialStorage: storage(10),
    groupSize: 5,
    readCapacity: async () => readings.shift() || storage(0, false),
    processGroup: async ({ limit }) => {
      limits.push(limit);
      return { processed: limit, results: [] };
    },
    logger: { info: () => {}, warn: () => {} },
  });
  assert.deepEqual(limits, [5, 2]);
  assert.equal(result.processedSlots, 7);
  assert.equal(result.stopReason, "capacity exhausted");
});

test("completed stages are reused only for the same input and processor", () => {
  const completed = {
    status: "completed",
    input_hash: "same",
    processor_version: PROCESSOR_VERSION,
  };
  assert.equal(shouldReuseStage(completed, "same"), true);
  assert.equal(shouldReuseStage(completed, "changed"), false);
  assert.equal(shouldReuseStage(completed, "same", "next-version"), false);
});

test("an embedding retry does not repeat extraction or chunking", () => {
  const input = "content-v1";
  const complete = (stage) => ({
    stage,
    status: "completed",
    input_hash: input,
    processor_version: PROCESSOR_VERSION,
  });
  const stages = pendingStages(
    [
      complete("FETCH"),
      complete("EXTRACT"),
      complete("NORMALIZE"),
      complete("CHUNK"),
      complete("FTS_INDEX"),
      {
        stage: "EMBED",
        status: "failed",
        input_hash: input,
        processor_version: PROCESSOR_VERSION,
      },
    ],
    Object.fromEntries([
      "FETCH", "EXTRACT", "NORMALIZE", "CHUNK", "FTS_INDEX", "EMBED",
    ].map((stage) => [stage, input])),
  );
  assert.equal(stages.includes("EXTRACT"), false);
  assert.equal(stages.includes("CHUNK"), false);
  assert.equal(stages.includes("EMBED"), true);
});

test("lexical search remains ready when semantic indexing fails", () => {
  const capabilities = deriveCapabilities({
    resourceReady: true,
    textReady: true,
    chunksCount: 4,
    lexicalReady: true,
    semanticReady: false,
    retrievalVerified: true,
  });
  assert.equal(capabilities.searchReady, true);
  assert.equal(capabilities.semanticReady, false);
  assert.equal(capabilities.chatReady, true);
  assert.equal(capabilities.comparisonReady, true);
});

test("pipeline failures resume at their actual expensive stage", () => {
  assert.equal(stageForPipelineFailure("embedding"), "EMBED");
  assert.equal(stageForPipelineFailure("vector_store"), "VECTOR_INDEX");
  assert.equal(stageForPipelineFailure("download"), "FETCH");
});

test("page-level OCR preserves good native pages and OCRs only bad pages", async () => {
  const nativePage = "This is a readable native policy page with enough alphabetic words to pass the extraction quality threshold. It contains official provisions and implementation details.";
  const ocrPage = "This OCR transcription restores the unreadable scanned page with enough words and letters to be accepted as usable official evidence for research.";
  const ocrCalls = [];
  const processor = new PDFProcessor({
    pageBufferExtractor: async (_buffer, pageIndex) => Buffer.from(`page-${pageIndex}`),
    ocrExtractor: async (pageBuffer) => {
      ocrCalls.push(pageBuffer.toString());
      return ocrPage;
    },
  });
  processor.downloadPDF = async () => Buffer.from("%PDF-page-level-test");
  processor.parsePDFBuffer = async () => ({
    fullText: `${nativePage}\f�`,
    pages: [nativePage, "�"],
    numPages: 2,
    info: {},
    metadata: {},
  });

  const result = await processor.processPDFByPages("https://example.test/document.pdf");
  assert.deepEqual(ocrCalls, ["page-1"]);
  assert.equal(result.extractionMethod, "pdf_text_with_page_ocr");
  assert.equal(result.pdfQuality.nativePages, 1);
  assert.equal(result.pdfQuality.ocrPages, 1);
  assert.match(result.fullText, /readable native policy page/);
  assert.match(result.fullText, /OCR transcription restores/);
});
