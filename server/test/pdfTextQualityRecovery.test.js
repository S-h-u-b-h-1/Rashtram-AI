const test = require("node:test");
const assert = require("node:assert/strict");

const { PDFProcessor } = require("../lib/pdfProcessor");
const {
  QUALITY,
  evidenceTextIsReliable,
  evaluateTextQuality,
  normalizeExtractedText,
} = require("../lib/pdfTextQuality");
const { assessEvidenceSufficiency, citationSupportsClaim } = require("../retrieval/evidenceSafetyService");
const { aggregateAudit, summarizeDocuments } = require("../document/pdfCorpusQualityService");

const english = "Section 14 requires the Central Government to publish implementation rules, establish an oversight authority, and report annually to Parliament. ".repeat(3);
const hindi = "धारा १४ के अनुसार केंद्र सरकार कार्यान्वयन नियम प्रकाशित करेगी, निगरानी प्राधिकरण स्थापित करेगी और संसद को वार्षिक रिपोर्ट देगी। ".repeat(3);

test("quality engine accepts English, Hindi and bilingual research text", () => {
  for (const text of [english, hindi, `${english}\n${hindi}`]) {
    const result = evaluateTextQuality(text);
    assert.equal(result.quality, QUALITY.GOOD);
    assert.equal(result.usable, true);
  }
});

test("quality engine rejects non-empty replacement, symbol, control, font-map and printable nonsense", () => {
  const corrupt = [
    "Valid �� �� �� �� �� �� �� �� text".repeat(8),
    "A@#$fZ %^& dKkl !@#$ %%^^ &&** ".repeat(12),
    `Government\u0000\u0001\u0002 policy ${"\u0003".repeat(20)}`,
    `${"\uE123".repeat(20)} Government authority regulation`,
    "qwxztr pqmra nzzqt vrklmp zzqtr qwxpt grmzz lpktr",
  ];
  corrupt.forEach((text) => {
    const result = evaluateTextQuality(text);
    assert.equal(result.usable, false, `${result.quality}: ${result.reasons.join(", ")}`);
    assert.ok(result.reasons.length > 0);
  });
});

test("safe normalization repairs ligatures, soft hyphens, zero-width text and clearly artificial spacing", () => {
  const normalized = normalizeExtractedText(
    "T h e G o v e r n m e n t o f I n d i a\nﬁnancial regu\u00adlation\u200b",
  );
  assert.match(normalized, /TheGovernmentofIndia/);
  assert.match(normalized, /financial regulation/);
  assert.doesNotMatch(normalized, /[ﬁ\u00ad\u200b]/u);
});

test("mixed PDF OCRs only corrupt pages, quality-checks OCR and preserves page identity", async () => {
  const calls = [];
  const processor = new PDFProcessor({
    pageBufferExtractor: async (_buffer, pageIndex) => Buffer.from(`page-${pageIndex}`),
    ocrExtractor: async (buffer) => {
      calls.push(buffer.toString());
      return "Section 22 establishes the recovered authority and preserves the official table: Category | Deadline | Responsible institution. ".repeat(3);
    },
  });
  processor.downloadPDF = async () => Buffer.from("%PDF-test");
  processor.parsePDFBuffer = async () => ({
    fullText: `${english}\f${"�".repeat(50)}`,
    pages: [english, "�".repeat(50)], numPages: 2, info: {}, metadata: {},
  });
  const result = await processor.processPDFAndCreateChunks("https://example.test/a.pdf", "44", "Test Act");
  assert.deepEqual(calls, ["page-1"]);
  assert.equal(result.pdfQuality.nativePages, 1);
  assert.equal(result.pdfQuality.ocrPages, 1);
  assert.deepEqual([...new Set(result.chunks.map((chunk) => chunk.pageStart))], [1, 2]);
  assert.ok(result.chunks.every((chunk) => chunk.pageStart === chunk.pageEnd && !chunk.pageEstimate));
  assert.ok(result.chunks.some((chunk) => /Category \| Deadline/.test(chunk.content)));
  assert.ok(result.chunks.every((chunk) => chunk.metadata.textQualityVersion));
});

test("OCR chatter is retried once and never becomes evidence", async () => {
  let attempts = 0;
  const processor = new PDFProcessor({ ocrExtractor: async () => {
    attempts += 1;
    return attempts === 1
      ? "Here is the transcription from the uploaded document in markdown."
      : "qwxztr pqmra nzzqt vrklmp zzqtr qwxpt grmzz lpktr";
  } });
  const recovered = await processor.recoverPageWithOcr(Buffer.from("page"), { score: 0.1 });
  assert.equal(attempts, 2);
  assert.equal(recovered.quality.usable, false);
  assert.equal(evidenceTextIsReliable({ content: recovered.text, extractionQuality: recovered.quality.quality }), false);
});

test("an unrecoverable page is excluded while good pages remain search-ready material", async () => {
  const processor = new PDFProcessor({
    pageBufferExtractor: async () => Buffer.from("bad-page"),
    ocrExtractor: async () => "Here is the transcription, but I cannot read the uploaded document.",
  });
  processor.downloadPDF = async () => Buffer.from("%PDF-partial");
  processor.parsePDFBuffer = async () => ({
    fullText: `${english}\f${"�".repeat(30)}`,
    pages: [english, "�".repeat(30)], numPages: 2, info: {}, metadata: {},
  });
  const result = await processor.processPDFAndCreateChunks("https://example.test/partial.pdf", "45", "Partial Act");
  assert.deepEqual(result.pdfQuality.failedPages, [2]);
  assert.equal(result.pdfQuality.partialRecovery, true);
  assert.ok(result.chunks.every((chunk) => chunk.pageStart === 1));
  assert.ok(result.chunks.every((chunk) => chunk.metadata.unreliablePages.includes("2")));
});

test("stray form feeds inside a page never fabricate citation page numbers", async () => {
  const processor = new PDFProcessor();
  processor.downloadPDF = async () => Buffer.from("%PDF-page-identity");
  processor.parsePDFBuffer = async () => ({
    fullText: `${english}\f${english}`,
    pages: [english, `${english}\f${english}`], numPages: 2, info: {}, metadata: {},
  });
  const result = await processor.processPDFAndCreateChunks("https://example.test/pages.pdf", "46", "Page Act");
  assert.equal(result.pdfQuality.documentTextQuality.totalPages, 2);
  assert.equal(result.chunks.every((chunk) => [1, 2].includes(chunk.pageStart)), true);
  assert.equal(Math.max(...result.chunks.map((chunk) => chunk.pageStart)), 2);
});

test("Evidence Safety excludes corrupt passages and accepts repaired evidence", () => {
  const bad = { content: "qwxztr pqmra nzzqt vrklmp zzqtr qwxpt grmzz lpktr", extractionQuality: "CORRUPTED" };
  const rejected = assessEvidenceSufficiency("What does section 14 require?", [bad]);
  assert.equal(rejected.decision, "ABSTAIN");
  assert.match(rejected.missing.join(" "), /Reliably extracted/);
  assert.equal(citationSupportsClaim("Section 14 requires annual reports", bad).supported, false);
  const repaired = { content: english, extractionQuality: "GOOD", extractionQualityScore: 1, ftsScore: 1 };
  assert.equal(evidenceTextIsReliable(repaired), true);
  assert.notEqual(assessEvidenceSufficiency("What does section 14 require?", [repaired]).decision, "ABSTAIN");
});

test("corpus audit is deterministic, bounded and prioritizes mixed corrupt PDFs", () => {
  const base = { document_id: 1, document_type: "act", title: "Act", source_name: "Official", year: 2026,
    extraction_method: "pdf_text", ocr_used: false, metadata_json: {} };
  const documents = summarizeDocuments([
    { ...base, chunk_index: 0, original_text: english, metadata_json: { pageStart: 1 } },
    { ...base, chunk_index: 1, original_text: "�".repeat(80), metadata_json: { pageStart: 2 } },
  ]);
  assert.equal(documents.length, 1);
  assert.equal(documents[0].mixedQuality, true);
  assert.notEqual(documents[0].severity, "GOOD");
  assert.ok(documents[0].diagnosticPages.length <= 12);
  const audit = aggregateAudit(documents);
  assert.equal(audit.counts.total, 1);
  assert.equal(audit.queue.P1, 1);
});
