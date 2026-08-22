const axios = require("axios");
const pdf = require("pdf-parse");
const { createCircuitBreaker } = require("./circuitBreaker");
const {
  downloadAndValidateDocument,
} = require("./documentDownloadService");
const {
  NORMALIZATION_VERSION,
  OCR_PROMPT_VERSION,
  TEXT_QUALITY_VERSION,
  aggregateDocumentQuality,
  evaluateTextQuality,
  normalizeExtractedText,
} = require("./pdfTextQuality");

const DEVANAGARI_PATTERN = /[\u0900-\u097f]/gu;
const LATIN_PATTERN = /[A-Za-z]/g;
const LETTER_PATTERN = /[\p{L}\p{M}]/gu;
const MAX_INLINE_OCR_BYTES = 18 * 1024 * 1024;

// Scoped independently from the embedding/generation breakers in vectordb.js
// so an OCR provider outage never blocks chunk creation for documents that
// already have a usable text layer (chunking must not depend on OCR/
// generation success).
const ocrBreaker = createCircuitBreaker("ocr", {
  failureThreshold: 5,
  cooldownMs: 30_000,
});

class PDFProcessor {
  constructor({ ocrExtractor, pageBufferExtractor } = {}) {
    this.chunkSize = 4500;
    this.overlap = 450;
    this.ocrExtractor = ocrExtractor;
    this.pageBufferExtractor = pageBufferExtractor;
    this.openAIClientPromise = null;
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
      isBilingual: languageCode === "hi-en",
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
      .replace(/[\x00-\x08\x0b\x0e-\x1f\x7f-\x9f]/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+([\u093a-\u094d\u0951-\u0957])/gu, "$1")
      .replace(/([क-ह])\s+([़])/gu, "$1$2")
      .replace(/ *([।॥])/gu, "$1 ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ {2,}/g, " ")
      .trim();
  }

  cleanPageArtifacts(text) {
    const pageNumber = /^(?:(?:page|पृष्ठ)\s*)?\d+(?:\s*(?:of|\/)\s*\d+)?$/iu;
    const pages = String(text || "").split(/\f/u);
    const boundaryCounts = new Map();
    const pageLines = pages.map((page) =>
      page
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    );

    for (const lines of pageLines) {
      for (const line of [...lines.slice(0, 2), ...lines.slice(-2)]) {
        if (line.length <= 140 && !pageNumber.test(line)) {
          boundaryCounts.set(line, (boundaryCounts.get(line) || 0) + 1);
        }
      }
    }
    const repeatedBoundaries = new Set(
      [...boundaryCounts.entries()]
        .filter(
          ([, count]) => pages.length >= 2 && count >= pages.length,
        )
        .map(([line]) => line),
    );

    return pageLines
      .map((lines) =>
        lines
          .filter(
            (line) =>
              !pageNumber.test(line) && !repeatedBoundaries.has(line),
          )
          .join("\n"),
      )
      .join("\f");
  }

  cleanText(text, languageCode = "und") {
    const normalized = normalizeExtractedText(this.cleanPageArtifacts(text))
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
    const quality = evaluateTextQuality(value);
    const letters = (value.match(LETTER_PATTERN) || []).length;
    const requiredLetters = Math.max(40, Number(numPages || 1) * 20);
    return quality.usable && letters >= requiredLetters;
  }

  pageExtractionQuality(text, options = {}) {
    const result = evaluateTextQuality(text, options);
    return {
      quality: result.quality,
      score: result.score,
      signals: result.signals,
      reasons: result.reasons,
      language: result.language,
      characters: result.signals.characters,
      words: result.signals.words,
      printableRatio: result.signals.printableRatio,
      alphabeticRatio: result.signals.alphabeticRatio,
      replacementRatio: result.signals.replacementRatio,
      nativeTextAvailable: result.signals.characters > 0,
      usable: result.usable,
      qualityEngineVersion: TEXT_QUALITY_VERSION,
    };
  }

  classifyPdfQuality({
    buffer,
    nativeText,
    numPages,
    ocrUsed,
    language,
  }) {
    const fileSizeBytes = Number(buffer?.length || 0);
    const pages = Math.max(Number(numPages || 0), 1);
    const textLength = String(nativeText || "").length;
    const charactersPerPage = Math.round(textLength / pages);
    let qualityClass = "native_text";
    if (ocrUsed) {
      qualityClass = "scanned";
    } else if (charactersPerPage < 180) {
      qualityClass = "mixed";
    }
    if (language?.isBilingual) qualityClass = "multi_language";
    if (fileSizeBytes > MAX_INLINE_OCR_BYTES) qualityClass = "very_large";
    if (fileSizeBytes > 0 && fileSizeBytes < 8_000) qualityClass = "very_small";
    return {
      qualityClass,
      fileSizeBytes,
      numPages: Number(numPages || 0),
      nativeTextLength: textLength,
      charactersPerPage,
      ocrUsed: Boolean(ocrUsed),
      isBilingual: Boolean(language?.isBilingual),
    };
  }

  sentenceUnits(text, languageCode = "und") {
    const boundary = languageCode.startsWith("hi")
      ? /(?<=[.!?।॥])\s+|\n{2,}|(?=\n(?:धारा|अध्याय|भाग|अनुसूची|\d+[.)]))/u
      : /(?<=[.!?])\s+|\n{2,}|(?=\n(?:section|chapter|part|schedule|\d+[.)]))/iu;
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
      const candidate = current ? `${current}\n\n${unit}` : unit;
      if (candidate.length > chunkSize && current) {
        pushChunk(current);
        const overlapText = current.slice(-overlap).replace(/^\S*\s*/, "");
        current = `${overlapText}\n\n${unit}`.trim();
      } else {
        current = candidate;
      }
    }
    pushChunk(current);
    return chunks;
  }

  structuralChunkMetadata(
    content,
    fullText,
    cursor,
    numPages,
  ) {
    const value = String(content || "");
    const heading = value.match(
      /(?:^|\n)\s*(section|article|rule|regulation|chapter|part|schedule|appendix|annexure|धारा|अनुच्छेद|नियम|अध्याय|भाग|अनुसूची)\s+([A-Z0-9IVXLC().-]+)([^\n]{0,180})/iu,
    );
    const clause = value.match(
      /(?:^|\n)\s*(\d+(?:\.\d+)*|\([a-z0-9ivx]+\))[\s.)-]+/iu,
    );
    const normalizedType = heading?.[1]?.toLowerCase() || (
      /\bdefinitions?\b|\bपरिभाषा\b/iu.test(value.slice(0, 500))
        ? "definitions"
        : clause
          ? "clause"
          : "passage"
    );
    const needle = value.slice(0, 120).trim();
    let start = needle ? fullText.indexOf(needle, Math.max(0, cursor - 500)) : -1;
    if (start < 0 && needle) start = fullText.indexOf(needle);
    if (start < 0) start = Math.max(0, cursor);
    const end = Math.min(fullText.length, start + value.length);
    const pages = Math.max(Number(numPages || 0), 1);
    const denominator = Math.max(fullText.length, 1);
    const pageStart = Math.min(
      pages,
      Math.max(1, Math.floor((start / denominator) * pages) + 1),
    );
    const pageEnd = Math.min(
      pages,
      Math.max(pageStart, Math.floor((end / denominator) * pages) + 1),
    );
    return {
      start,
      end,
      pageStart,
      pageEnd,
      pageEstimate: true,
      structuralType: normalizedType,
      sectionId: heading?.[2] || null,
      sectionTitle: heading
        ? `${heading[1]} ${heading[2]}${heading[3] || ""}`.trim()
        : null,
      clauseId: clause?.[1] || null,
    };
  }

  async downloadPDF(pdfUrl) {
    const result = await downloadAndValidateDocument(pdfUrl, {
      accept: "application/pdf",
      expectedExtension: "pdf",
    });
    this.lastDownloadResult = result;
    return result.buffer;
  }

  async parsePDFBuffer(buffer) {
    const pages = [];
    const pagerender = async (pageData) => {
      const content = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });
      let previousY = null;
      let pageText = "";
      for (const item of content.items || []) {
        const y = item.transform?.[5];
        if (previousY != null && y !== previousY) pageText += "\n";
        else if (pageText && !pageText.endsWith("\n")) pageText += " ";
        pageText += item.str || "";
        previousY = y;
      }
      pages.push(pageText);
      return pageText;
    };
    const pdfData = await pdf(buffer, { pagerender });
    return {
      fullText: pages.length ? pages.join("\f") : pdfData.text || "",
      pages,
      numPages: pdfData.numpages || 0,
      info: pdfData.info,
      metadata: pdfData.metadata,
    };
  }

  async extractSinglePageBuffer(buffer, pageIndex) {
    if (this.pageBufferExtractor) {
      return this.pageBufferExtractor(buffer, pageIndex);
    }
    const { PDFDocument } = require("pdf-lib");
    const source = await PDFDocument.load(buffer, { ignoreEncryption: false });
    const target = await PDFDocument.create();
    const [page] = await target.copyPages(source, [pageIndex]);
    target.addPage(page);
    return Buffer.from(await target.save({ useObjectStreams: true }));
  }

  async getOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const error = new Error(
        "OCR is unavailable because OPENAI_API_KEY or GEMINI_API_KEY is not configured.",
      );
      error.status = 422;
      throw error;
    }
    if (String(process.env.AI_PROVIDER || "").toLowerCase() !== "openai") {
      // The old wording here ("disabled because Gemini is the configured
      // AI provider") was actively misleading: this branch is reached
      // precisely when Gemini is NOT usable — extractTextWithOcr only
      // falls through to OpenAI when GEMINI_API_KEY is absent. It sent
      // 326 production OCR failures to the wrong diagnosis. State the
      // real condition instead.
      const error = new Error(
        "OCR is unavailable: no Gemini API key is configured, and the OpenAI " +
          "OCR path requires AI_PROVIDER=openai to be set explicitly. " +
          "Set GEMINI_API_KEY, or set AI_PROVIDER=openai with OPENAI_API_KEY.",
      );
      error.status = 422;
      error.failureStage = "ocr";
      throw error;
    }
    if (!process.env.OPENAI_API_KEY) {
      const error = new Error(
        "OCR is unavailable because OPENAI_API_KEY or GEMINI_API_KEY is not configured.",
      );
      error.status = 422;
      throw error;
    }
    if (!this.openAIClientPromise) {
      let configuredBaseUrl = (process.env.OPENAI_BASE_URL || "").trim();
      if (String(apiKey || "").startsWith("AIza") && !configuredBaseUrl) {
        configuredBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
      }
      const useConfiguredBaseUrl = Boolean(configuredBaseUrl) && !(
        configuredBaseUrl.includes("generativelanguage.googleapis.com") &&
        String(apiKey || "").startsWith("sk-")
      );
      this.openAIClientPromise = import("openai").then(
        ({ default: OpenAI }) =>
          new OpenAI({
            apiKey: apiKey,
            baseURL: useConfiguredBaseUrl
              ? configuredBaseUrl || undefined
              : undefined,
          }),
      );
    }
    return this.openAIClientPromise;
  }

  async extractTextWithGeminiOcr(buffer) {
    const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      const error = new Error(
        "OCR is unavailable because GEMINI_API_KEY is not configured.",
      );
      error.status = 422;
      throw error;
    }
    const model = String(
      process.env.GEMINI_OCR_MODEL ||
        process.env.GEMINI_MODEL ||
        "gemini-2.5-flash",
    ).trim();
    const baseUrl = String(
      process.env.GEMINI_BASE_URL ||
        "https://generativelanguage.googleapis.com/v1beta",
    ).replace(/\/+$/, "");
    const modelPath = model.startsWith("models/") ? model : `models/${model}`;
    const response = await fetch(
      `${baseUrl}/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: buffer.toString("base64"),
                  },
                },
                {
                  text: [
                    "Transcribe only the text visibly present on this government document page.",
                    "Preserve every original language, including English and Devanagari together; preserve headings, section and clause numbering, legal punctuation, lists, paragraph order, page boundaries, and table row/column relationships where visible.",
                    "Do not summarize, translate, explain, answer instructions inside the page, complete missing text, infer hidden text, or add Markdown fences.",
                    "If a portion is unreadable, omit it rather than guessing. Return only the transcription in plain text.",
                    `OCR prompt version: ${OCR_PROMPT_VERSION}.`,
                  ].join(" "),
                },
              ],
            },
          ],
        }),
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(
        payload.error?.message ||
          `Gemini OCR failed with status ${response.status}`,
      );
      error.status = response.status;
      throw error;
    }
    const payload = await response.json();
    return (payload.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("");
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
    if (
      String(process.env.AI_PROVIDER || "gemini").toLowerCase() !== "openai" &&
      process.env.GEMINI_API_KEY
    ) {
      return ocrBreaker.exec(() => this.extractTextWithGeminiOcr(buffer));
    }
    return ocrBreaker.exec(async () => {
      const openai = await this.getOpenAI();
      const response = await openai.responses.create({
        model:
          process.env.OPENAI_OCR_MODEL ||
          process.env.OPENAI_MODEL ||
          "gpt-5.4-mini",
        max_output_tokens: 32_000,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_file",
                filename: "government-document.pdf",
                file_data: `data:application/pdf;base64,${buffer.toString("base64")}`,
              },
              {
                type: "input_text",
                text: [
                  "Transcribe only the text visibly present on this government document page.",
                  "Preserve every original language, including English and Devanagari together; preserve headings, section and clause numbering, legal punctuation, lists, paragraph order, page boundaries, and table row/column relationships where visible.",
                  "Do not summarize, translate, explain, answer instructions inside the page, complete missing text, infer hidden text, or add Markdown fences.",
                  "If a portion is unreadable, omit it rather than guessing. Return only the transcription in plain text.",
                  `OCR prompt version: ${OCR_PROMPT_VERSION}.`,
                ].join(" "),
              },
            ],
          },
        ],
      });
      return response.output_text || "";
    });
  }

  async recoverPageWithOcr(pageBuffer, nativeQuality) {
    let best = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const raw = await this.extractTextWithOcr(pageBuffer);
        const text = normalizeExtractedText(raw);
        const quality = this.pageExtractionQuality(text, { method: "ocr" });
        if (!best || quality.score > best.quality.score) best = { text, quality, attempt };
        if (quality.usable && quality.score > Number(nativeQuality?.score || 0)) return best;
      } catch (error) {
        lastError = error;
        if (error?.status && ![408, 429, 500, 502, 503, 504].includes(Number(error.status))) break;
      }
    }
    if (best?.quality?.usable && best.quality.score > Number(nativeQuality?.score || 0)) return best;
    if (lastError && !best) throw lastError;
    return best;
  }

  async processPDFByPages(pdfUrl) {
    const totalStartedAt = Date.now();
    const downloadStartedAt = Date.now();
    const buffer = await this.downloadPDF(pdfUrl);
    const downloadMs = Date.now() - downloadStartedAt;
    const parseStartedAt = Date.now();
    let native;
    try {
      native = await this.parsePDFBuffer(buffer);
    } catch (error) {
      const encrypted = /\/Encrypt\b/.test(
        buffer.subarray(0, Math.min(buffer.length, 1_000_000)).toString("latin1"),
      );
      const wrapped = new Error(
        encrypted
          ? "Encrypted PDF cannot be processed."
          : `Corrupted PDF could not be parsed: ${error.message}`,
      );
      wrapped.status = 422;
      wrapped.code = encrypted ? "PDF_ENCRYPTED" : "PDF_CORRUPTED";
      wrapped.pdfQualityClass = encrypted ? "encrypted" : "corrupted";
      throw wrapped;
    }
    const parseMs = Date.now() - parseStartedAt;
    let fullText = native.fullText;
    let extractionMethod = "pdf_text";
    let ocrUsed = false;
    let ocrRequired = false;
    let ocrMs = 0;
    const hasNativePageBoundaries = (native.pages || []).length > 0;
    const nativePages = hasNativePageBoundaries
      ? native.pages
      : String(native.fullText || "").split(/\f/u).filter((page) => page.length);
    let selectedPages = nativePages.map((text) => normalizeExtractedText(text));
    let pageExtraction = nativePages.map((text, index) => {
      const rawQuality = this.pageExtractionQuality(text, { method: "native" });
      const normalizedText = selectedPages[index];
      const normalizedQuality = this.pageExtractionQuality(normalizedText, { method: "normalized_native" });
      const useNormalized = normalizedQuality.score >= rawQuality.score && normalizedText !== text;
      return {
        page: index + 1,
        method: useNormalized ? "normalized_native" : "native",
        nativeQuality: rawQuality.quality,
        normalizationApplied: useNormalized,
        ...(useNormalized ? normalizedQuality : rawQuality),
      };
    });
    const unusablePages = pageExtraction
      .filter((page) => !page.usable)
      .map((page) => page.page - 1);

    if (unusablePages.length > 0 && hasNativePageBoundaries) {
      ocrRequired = true;
      const ocrStartedAt = Date.now();
      for (const pageIndex of unusablePages) {
        try {
          const pageBuffer = await this.extractSinglePageBuffer(buffer, pageIndex);
          const recovered = await this.recoverPageWithOcr(pageBuffer, pageExtraction[pageIndex]);
          if (recovered?.quality?.usable) {
            selectedPages[pageIndex] = recovered.text;
            pageExtraction[pageIndex] = {
              page: pageIndex + 1,
              method: "ocr",
              nativeQuality: pageExtraction[pageIndex].quality,
              ocrAttempts: recovered.attempt,
              ...recovered.quality,
            };
          } else {
            selectedPages[pageIndex] = "";
            pageExtraction[pageIndex] = {
              ...pageExtraction[pageIndex],
              usable: false,
              recoveryFailed: true,
              ocrAttempts: recovered?.attempt || 2,
            };
          }
        } catch (error) {
          selectedPages[pageIndex] = "";
          pageExtraction[pageIndex] = {
            ...pageExtraction[pageIndex],
            page: pageIndex + 1,
            usable: false,
            recoveryFailed: true,
            ocrFailureCode: error.failureCode || error.code || "OCR_FAILED",
          };
        }
      }
      fullText = selectedPages.join("\f");
      ocrMs = Date.now() - ocrStartedAt;
      extractionMethod = "pdf_text_with_page_ocr";
      ocrUsed = pageExtraction.some((page) => page.method === "ocr");
    } else if (!this.hasUsableText(fullText, native.numPages)) {
      ocrRequired = true;
      const ocrStartedAt = Date.now();
      const nativeQuality = this.pageExtractionQuality(fullText, { method: "native" });
      const recovered = await this.recoverPageWithOcr(buffer, nativeQuality);
      fullText = recovered?.quality?.usable ? recovered.text : "";
      ocrMs = Date.now() - ocrStartedAt;
      extractionMethod =
        String(process.env.AI_PROVIDER || "gemini").toLowerCase() === "openai"
          ? "openai_ocr"
          : "gemini_ocr";
      ocrUsed = true;
      pageExtraction = [{
        page: 1,
        method: "ocr_document_fallback",
        ocrAttempts: recovered?.attempt || 2,
        ...(recovered?.quality || this.pageExtractionQuality(fullText, { method: "ocr" })),
      }];
      selectedPages = [fullText];
    }
    const documentQuality = aggregateDocumentQuality(pageExtraction);
    if (!documentQuality.usablePages || !this.hasUsableText(fullText, Math.max(1, documentQuality.usablePages))) {
      const error = new Error(
        "No usable text could be extracted from this scanned PDF.",
      );
      error.status = 422;
      throw error;
    }

    const language = this.detectLanguage(fullText);
    const cleanupStartedAt = Date.now();
    // The parser's page array is authoritative. Some broken text layers and
    // OCR responses contain stray form-feed characters inside a physical page;
    // replace those internally before cross-page boilerplate cleanup so they
    // can never create fabricated page coordinates.
    const pageSafeText = selectedPages
      .map((page) => String(page || "").replace(/\f/gu, "\n"))
      .join("\f");
    const artifactCleanedPages = this.cleanPageArtifacts(pageSafeText).split(/\f/u);
    selectedPages = selectedPages.map((_, index) =>
      this.cleanText(artifactCleanedPages[index] || "", language.languageCode),
    );
    const cleanedText = selectedPages.join("\f");
    const cleanupMs = Date.now() - cleanupStartedAt;
    const pdfQuality = this.classifyPdfQuality({
      buffer,
      nativeText: native.fullText,
      numPages: native.numPages,
      ocrUsed,
      language,
    });
    pdfQuality.pageExtraction = pageExtraction;
    pdfQuality.documentTextQuality = documentQuality;
    pdfQuality.qualityEngineVersion = TEXT_QUALITY_VERSION;
    pdfQuality.normalizationVersion = NORMALIZATION_VERSION;
    pdfQuality.ocrPromptVersion = OCR_PROMPT_VERSION;
    pdfQuality.nativePages = pageExtraction.filter((page) => ["native", "normalized_native"].includes(page.method) && page.usable).length;
    pdfQuality.ocrPages = pageExtraction.filter((page) => page.method === "ocr").length;
    pdfQuality.failedPages = documentQuality.failedPages;
    pdfQuality.partialRecovery = documentQuality.partialRecovery;
    return {
      ...native,
      pages: selectedPages,
      fullText: cleanedText,
      originalText: cleanedText,
      originalLength: String(fullText).length,
      cleanedLength: cleanedText.length,
      extractionMethod,
      ocrUsed,
      ocrRequired,
      language,
      fileSizeBytes: buffer.length,
      pdfQuality,
      stageMetrics: {
        downloadMs,
        downloadAttempts: this.lastDownloadResult?.attempts?.length || 1,
        downloadFinalUrl: this.lastDownloadResult?.finalUrl || pdfUrl,
        downloadChecksumSha256:
          this.lastDownloadResult?.validation?.checksumSha256 || null,
        downloadValidation: this.lastDownloadResult?.validation || null,
        parseMs,
        ocrMs,
        cleanupMs,
        pagesEvaluated: pageExtraction.length,
        nativeGoodPages: pageExtraction.filter((page) => ["native", "normalized_native"].includes(page.method) && page.quality === "GOOD").length,
        nativeSuspiciousPages: pageExtraction.filter((page) => page.nativeQuality === "SUSPICIOUS").length,
        nativeCorruptPages: pageExtraction.filter((page) => ["CORRUPTED", "UNRECOVERABLE"].includes(page.nativeQuality)).length,
        ocrPagesRequested: unusablePages.length,
        ocrPagesRecovered: pageExtraction.filter((page) => page.method === "ocr" && page.usable).length,
        ocrPagesFailed: pageExtraction.filter((page) => page.recoveryFailed).length,
        averageExtractionQuality: documentQuality.averageScore,
        pdfTotalMs: Date.now() - totalStartedAt,
      },
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
      ocrRequired: result.ocrRequired,
    };
  }

  async processPDFAndCreateChunks(pdfUrl, documentId, title) {
    const pdfData = await this.processPDFByPages(pdfUrl);
    const languageCode = pdfData.language.languageCode;
    const pageQuality = new Map(
      (pdfData.pdfQuality.pageExtraction || []).map((entry) => [Number(entry.page), entry]),
    );
    const chunkRecords = [];
    for (let pageIndex = 0; pageIndex < pdfData.pages.length; pageIndex += 1) {
      const page = pageIndex + 1;
      const text = String(pdfData.pages[pageIndex] || "").trim();
      const quality = pageQuality.get(page) || this.pageExtractionQuality(text);
      if (!quality.usable || !text) continue;
      const pageChunks = this.chunkText(text, this.chunkSize, this.overlap, languageCode);
      let cursor = 0;
      for (const content of pageChunks) {
        const structure = this.structuralChunkMetadata(content, text, cursor, 1);
        chunkRecords.push({ content, page, quality, structure });
        cursor = Math.max(cursor + 1, text.indexOf(content, cursor) + Math.max(1, content.length - this.overlap));
      }
    }
    if (!chunkRecords.length) {
      const error = new Error(
        "Extracted text was insufficient to create research passages.",
      );
      error.status = 422;
      throw error;
    }

    const structuredChunks = chunkRecords.map(({ content, page, quality, structure }, index) => ({
      ...structure,
      pageStart: page,
      pageEnd: page,
      pageEstimate: false,
      id: `${documentId}-chunk-${index}`,
      billId: String(documentId),
      title,
      content,
      chunkIndex: index,
      totalChunks: chunkRecords.length,
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
        ocrRequired: pdfData.ocrRequired,
        isBilingual: pdfData.language.isBilingual,
        pdfQualityClass: pdfData.pdfQuality.qualityClass,
        extractionQuality: quality.quality,
        extractionQualityScore: quality.score,
        extractionQualityReasons: quality.reasons,
        textQualityVersion: TEXT_QUALITY_VERSION,
        normalizationVersion: NORMALIZATION_VERSION,
        ocrPromptVersion: OCR_PROMPT_VERSION,
        usablePageCoverage: pdfData.pdfQuality.documentTextQuality?.usableCoverage,
        unreliablePages: (pdfData.pdfQuality.failedPages || []).map(String),
      },
    }));

    for (const chunk of structuredChunks) {
      chunk.metadata.pageStart = chunk.pageStart;
      chunk.metadata.pageEnd = chunk.pageEnd;
      chunk.metadata.pageEstimate = chunk.pageEstimate;
      chunk.metadata.structuralType = chunk.structuralType;
      chunk.metadata.sectionId = chunk.sectionId;
      chunk.metadata.sectionTitle = chunk.sectionTitle;
      chunk.metadata.clauseId = chunk.clauseId;
    }

    return {
      chunks: structuredChunks,
      totalChunks: chunkRecords.length,
      originalText: pdfData.originalText,
      originalLength: pdfData.originalLength,
      cleanedLength: pdfData.cleanedLength,
      language: pdfData.language,
      extractionMethod: pdfData.extractionMethod,
      ocrUsed: pdfData.ocrUsed,
      ocrRequired: pdfData.ocrRequired,
      pdfMetadata: {
        numPages: pdfData.numPages,
        info: pdfData.info,
        metadata: pdfData.metadata,
        fileSizeBytes: pdfData.fileSizeBytes,
        quality: pdfData.pdfQuality,
      },
      pdfQuality: pdfData.pdfQuality,
      stageMetrics: pdfData.stageMetrics,
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
