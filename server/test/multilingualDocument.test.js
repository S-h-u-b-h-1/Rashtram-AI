const test = require("node:test");
const assert = require("node:assert/strict");
const { PDFProcessor } = require("../lib/pdfProcessor");

test("language detection distinguishes English, Hindi, and bilingual text", () => {
  const processor = new PDFProcessor();
  assert.equal(
    processor.detectLanguage(
      "यह भारत सरकार की हिन्दी नीति और कार्यान्वयन के लिए आधिकारिक सूचना है।",
    ).languageCode,
    "hi",
  );
  assert.equal(
    processor.detectLanguage(
      "This official government policy explains implementation and oversight.",
    ).languageCode,
    "en",
  );
  assert.equal(
    processor.detectLanguage(
      "भारत सरकार की आधिकारिक नीति। This official policy explains implementation.",
    ).languageCode,
    "hi-en",
  );
});

test("Devanagari cleanup preserves original letters and sentence marks", () => {
  const processor = new PDFProcessor();
  const cleaned = processor.cleanText(
    "भारत   सरकार ।\r\n\r\n  योजना  लागू होगी॥",
    "hi",
  );
  assert.match(cleaned, /भारत सरकार।/);
  assert.match(cleaned, /योजना लागू होगी॥/);
  assert.doesNotMatch(cleaned, /\r/);
});

test("Hindi-aware chunking splits on danda without discarding source text", () => {
  const processor = new PDFProcessor();
  const source =
    "यह पहला आधिकारिक वाक्य है। यह दूसरा आधिकारिक वाक्य है। यह तीसरा आधिकारिक वाक्य है।";
  const chunks = processor.chunkText(source, 55, 10, "hi");
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.some((chunk) => chunk.includes("।")));
  assert.ok(chunks.join(" ").includes("तीसरा आधिकारिक वाक्य"));
});

test("scanned PDFs use OCR only when native text is insufficient", async () => {
  const processor = new PDFProcessor({
    ocrExtractor: async () =>
      "यह स्कैन किए गए सरकारी दस्तावेज़ का मूल हिन्दी पाठ है। ".repeat(8),
  });
  processor.downloadPDF = async () => Buffer.from("%PDF-test");
  processor.parsePDFBuffer = async () => ({
    fullText: "\n\n",
    numPages: 2,
    info: {},
    metadata: {},
  });

  const result = await processor.processPDFByPages("https://example.gov.in/a.pdf");
  assert.equal(result.ocrUsed, true);
  assert.equal(result.extractionMethod, "gemini_ocr");
  assert.equal(result.language.languageCode, "hi");
  assert.match(result.originalText, /मूल हिन्दी पाठ/);
});
