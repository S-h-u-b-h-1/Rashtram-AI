const axios = require("axios");
const pdf = require("pdf-parse");

const DEVANAGARI_PATTERN = /[\u0900-\u097f]/gu;
const LATIN_PATTERN = /[A-Za-z]/g;
const LETTER_PATTERN = /[\p{L}\p{M}]/gu;
const MAX_INLINE_OCR_BYTES = 18 * 1024 * 1024;

const responseText = (response) => {
  if (typeof response?.text === "function") return response.text();
  return response?.text || "";
};

class PDFProcessor {
  constructor({ ocrExtractor } = {}) {
    this.chunkSize = 4500;
    this.overlap = 450;
    this.ocrExtractor = ocrExtractor;
    this.geminiClientPromise = null;
  }

  detectLanguage(text) {
    const value = String(text || "").normalize("NFC");
    const devanagari = (value.match(DEVANAGARI_PATTERN) || []).length;
    const latin = (value.match(LATIN_PATTERN) || []).length;
    const letters = (value.match(LETTER_PATTERN) || []).length;
    const identified = devanagari + latin;

    let languageCode = "und";
    let script = "Unknown";
    if (devanagari >= 20 && latin >= 20) {
      languageCode = "hi-en";
      script = "Devanagari+Latin";
    } else if (
      devanagari >= 20 &&
      (!identified || devanagari / identified >= 0.55)
    ) {
      languageCode = "hi";
      script = "Devanagari";
    } else if (latin >= 20) {
      languageCode = "en";
      script = "Latin";
    }

    return {
      languageCode,
      script,
      confidence:
        identified > 0
          ? Number((Math.max(devanagari, latin) / identified).toFixed(3))
          : 0,
      devanagariCharacters: devanagari,
      latinCharacters: latin,
      letterCharacters: letters,
    };
  }

  cleanHindiText(text) {
    return String(text || "")
      .normalize("NFC")
      .replace(/\u00ad/g, "")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/ *([।॥])/gu, "$1 ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ {2,}/g, " ")
      .trim();
  }

  cleanText(text, languageCode = "und") {
    const normalized = String(text || "")
      .normalize("NFC")
      .replace(/\u00ad/g, "")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return languageCode.startsWith("hi")
      ? this.cleanHindiText(normalized)
      : normalized;
  }

  hasUsableText(text, numPages = 1) {
    const value = String(text || "").trim();
    const letters = (value.match(LETTER_PATTERN) || []).length;
    const requiredLetters = Math.max(80, Number(numPages || 1) * 25);
    return letters >= requiredLetters;
  }

  sentenceUnits(text, languageCode = "und") {
    const boundary = languageCode.startsWith("hi")
      ? /(?<=[.!?।॥])\s+|\n{2,}/u
      : /(?<=[.!?])\s+|\n{2,}/u;
    return String(text || "")
      .split(boundary)
      .map((unit) => unit.trim())
      .filter(Boolean);
  }

  chunkText(
    text,
    chunkSize = this.chunkSize,
    overlap = this.overlap,
    languageCode = "und",
  ) {
    const units = this.sentenceUnits(text, languageCode);
    const chunks = [];
    let current = "";

    const pushChunk = (value) => {
      const part = String(value || "").trim();
      if (!part) return;
      chunks.push(part);
    };

    const appendOversizedUnit = (unit) => {
      for (let start = 0; start < unit.length; start += chunkSize - overlap) {
        const part = unit.slice(start, start + chunkSize).trim();
        pushChunk(part);
      }
    };

    for (const unit of units) {
      if (unit.length > chunkSize) {
        pushChunk(current);
        current = "";
        appendOversizedUnit(unit);
        continue;
      }
      const candidate = current ? `${current} ${unit}` : unit;
      if (candidate.length > chunkSize && current) {
        pushChunk(current);
        const overlapText = current.slice(-overlap).replace(/^\S*\s*/, "");
        current = `${overlapText} ${unit}`.trim();
      } else {
        current = candidate;
      }
    }
    pushChunk(current);
    return chunks;
  }

  async downloadPDF(pdfUrl) {
    const response = await axios.get(pdfUrl, {
      responseType: "arraybuffer",
      timeout: 30_000,
      maxContentLength: 30 * 1024 * 1024,
      maxBodyLength: 30 * 1024 * 1024,
      headers: {
        Accept: "application/pdf",
        "User-Agent": "RashtramAI/1.0 (+https://rashtram-ai.vercel.app)",
      },
    });
    return Buffer.from(response.data);
  }

  async parsePDFBuffer(buffer) {
    const pdfData = await pdf(buffer);
    return {
      fullText: pdfData.text || "",
      numPages: pdfData.numpages || 0,
      info: pdfData.info,
      metadata: pdfData.metadata,
    };
  }

  async getGemini() {
    if (!process.env.GEMINI_API_KEY) {
      const error = new Error(
        "OCR is unavailable because GEMINI_API_KEY is not configured.",
      );
      error.status = 422;
      throw error;
    }
    if (!this.geminiClientPromise) {
      this.geminiClientPromise = import("@google/genai").then(
        ({ GoogleGenAI }) =>
          new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
      );
    }
    return this.geminiClientPromise;
  }

  async extractTextWithOcr(buffer) {
    if (this.ocrExtractor) return this.ocrExtractor(buffer);
    if (buffer.length > MAX_INLINE_OCR_BYTES) {
      const error = new Error(
        "The scanned PDF is too large for inline OCR processing.",
      );
      error.status = 422;
      throw error;
    }
    const ai = await this.getGemini();
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_OCR_MODEL || "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: buffer.toString("base64"),
              },
            },
            {
              text: [
                "Transcribe this scanned Indian government document exactly.",
                "Preserve the original language, Devanagari text, numbers,",
                "headings, paragraph order, and page breaks. Do not translate,",
                "summarize, explain, or invent missing text. Return only the",
                "transcription in plain text.",
              ].join(" "),
            },
          ],
        },
      ],
    });
    return responseText(response);
  }

  async processPDFByPages(pdfUrl) {
    const buffer = await this.downloadPDF(pdfUrl);
    const native = await this.parsePDFBuffer(buffer);
    let fullText = native.fullText;
    let extractionMethod = "pdf_text";
    let ocrUsed = false;

    if (!this.hasUsableText(fullText, native.numPages)) {
      fullText = await this.extractTextWithOcr(buffer);
      extractionMethod = "gemini_ocr";
      ocrUsed = true;
    }
    if (!this.hasUsableText(fullText, native.numPages)) {
      const error = new Error(
        "No usable text could be extracted from this scanned PDF.",
      );
      error.status = 422;
      throw error;
    }

    const language = this.detectLanguage(fullText);
    const cleanedText = this.cleanText(fullText, language.languageCode);
    return {
      ...native,
      fullText: cleanedText,
      originalText: cleanedText,
      originalLength: String(fullText).length,
      cleanedLength: cleanedText.length,
      extractionMethod,
      ocrUsed,
      language,
      fileSizeBytes: buffer.length,
    };
  }

  async extractTextFromPDF(pdfUrl) {
    const result = await this.processPDFByPages(pdfUrl);
    return {
      text: result.fullText,
      numPages: result.numPages,
      info: result.info,
      metadata: result.metadata,
      language: result.language,
      extractionMethod: result.extractionMethod,
      ocrUsed: result.ocrUsed,
    };
  }

  async processPDFAndCreateChunks(pdfUrl, documentId, title) {
    const pdfData = await this.processPDFByPages(pdfUrl);
    const languageCode = pdfData.language.languageCode;
    const chunks = this.chunkText(
      pdfData.fullText,
      this.chunkSize,
      this.overlap,
      languageCode,
    );
    if (!chunks.length) {
      const error = new Error(
        "Extracted text was insufficient to create research passages.",
      );
      error.status = 422;
      throw error;
    }

    const structuredChunks = chunks.map((content, index) => ({
      id: `${documentId}-chunk-${index}`,
      billId: String(documentId),
      title,
      content,
      chunkIndex: index,
      totalChunks: chunks.length,
      metadata: {
        source: "pdf",
        pdfUrl,
        numPages: pdfData.numPages,
        extractedAt: new Date().toISOString(),
        chunkSize: content.length,
        chunkMethod: languageCode.startsWith("hi")
          ? "hindi-sentence-overlap"
          : "sentence-overlap",
        languageCode,
        script: pdfData.language.script,
        extractionMethod: pdfData.extractionMethod,
        ocrUsed: pdfData.ocrUsed,
      },
    }));

    return {
      chunks: structuredChunks,
      totalChunks: chunks.length,
      originalText: pdfData.originalText,
      originalLength: pdfData.originalLength,
      cleanedLength: pdfData.cleanedLength,
      language: pdfData.language,
      extractionMethod: pdfData.extractionMethod,
      ocrUsed: pdfData.ocrUsed,
      pdfMetadata: {
        numPages: pdfData.numPages,
        info: pdfData.info,
        metadata: pdfData.metadata,
        fileSizeBytes: pdfData.fileSizeBytes,
      },
    };
  }

  extractBillSections(text) {
    const sections = {
      title: "",
      preamble: "",
      provisions: [],
      schedules: [],
      definitions: "",
    };
    const titleMatch = String(text).match(/^([A-Z\s,]+(?:BILL|ACT))/i);
    if (titleMatch) sections.title = titleMatch[1].trim();
    const preambleMatch = String(text).match(
      /^(.*?)(?:SECTION\s+1|1\.\s)/is,
    );
    if (preambleMatch) {
      sections.preamble = preambleMatch[1]
        .replace(sections.title, "")
        .trim();
    }
    const sectionMatches = String(text).match(
      /(?:SECTION|Section)\s+\d+[^]*?(?=(?:SECTION|Section)\s+\d+|\n\n|$)/gi,
    );
    if (sectionMatches) {
      sections.provisions = sectionMatches.map((section) => section.trim());
    }
    return sections;
  }

  async analyzePDFContent(pdfUrl, documentId, title) {
    const pdfData = await this.processPDFByPages(pdfUrl);
    return {
      analysis: {
        documentId,
        title,
        totalLength: pdfData.fullText.length,
        numPages: pdfData.numPages,
        sections: this.extractBillSections(pdfData.fullText),
        language: pdfData.language,
        extractionMethod: pdfData.extractionMethod,
        extractedAt: new Date().toISOString(),
      },
      fullText: pdfData.fullText,
      metadata: pdfData,
    };
  }
}

const pdfProcessor = new PDFProcessor();

module.exports = {
  MAX_INLINE_OCR_BYTES,
  PDFProcessor,
  pdfProcessor,
};
