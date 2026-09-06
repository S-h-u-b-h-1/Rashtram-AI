const PDFDocument = require("pdfkit");
const path = require("node:path");

const configureUnicodeFonts = (pdf) => {
  const fonts = path.join(__dirname, "../assets/fonts");
  // This Noto release includes Latin and Devanagari in the same font, so mixed
  // text retains complete shaping runs and requires no text/font interception.
  pdf.registerFont("Rashtram-Regular", path.join(fonts, "NotoSansDevanagari-Regular.ttf"));
  pdf.registerFont("Rashtram-Bold", path.join(fonts, "NotoSansDevanagari-Bold.ttf"));
  pdf.registerFont("Rashtram-Display", path.join(fonts, "NotoSansDevanagari-Bold.ttf"));
};

const compact = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .trim();

const plainMarkdown = (value) =>
  compact(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n");

const isPdfExportRequest = (value) => {
  const text = compact(value).toLowerCase();
  // Mentioning a source PDF or its pages is evidence intent, not file export.
  const requestsFile = /\b(download|downloadable|export)\b/.test(text)
    || /\b(?:create|generate|make|produce|save|convert|provide)\b[^.!?]{0,60}\b(?:a|as|to|into|in)\s+(?:a\s+)?pdf\b/.test(text)
    || /\b(?:answer|response|report|brief|summary|analysis)\s+(?:as|in)\s+(?:a\s+)?pdf\b/.test(text);
  const refersToOutput = /\b(report|brief|response|answer|analysis|summary|document)\b/.test(text);
  return requestsFile && refersToOutput;
};

const isExportableReportMessage = (message) => {
  const text = compact(message?.text);
  if (message?.sender !== "assistant" || text.length < 180) return false;
  if (message?.metadata?.exportReady) return false;
  return !/(cannot|can't|unable).{0,80}(provide|create|download|export).{0,40}pdf|capabilit(?:y|ies).{0,40}limited/is.test(text);
};

const safeFilePart = (value, fallback = "research-brief") => {
  const normalized = compact(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
};

// Measure complete shaped lines, including mixed scripts and malformed legacy
// extraction, instead of relying on PDFKit's word-by-word width estimates.
const writeWrappedText = (pdf, value, { indent = 0, lineGap = 3, ...options } = {}) => {
  const x = pdf.page.margins.left + indent;
  const width = pdf.page.width - pdf.page.margins.right - x;
  const emit = (line) => {
    const height = pdf.currentLineHeight(true) + lineGap;
    if (pdf.y + height > pdf.page.height - pdf.page.margins.bottom) pdf.addPage();
    const y = pdf.y;
    pdf.text(line, x, y, { ...options, lineBreak: false, width });
    pdf.x = pdf.page.margins.left;
    pdf.y = y + height;
  };
  for (const paragraph of String(value || "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/u).filter(Boolean)) {
      const proposed = line ? `${line} ${word}` : word;
      if (pdf.widthOfString(proposed) <= width) { line = proposed; continue; }
      if (line) { emit(line); line = ""; }
      for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)) {
        if (line && pdf.widthOfString(line + segment) > width) { emit(line); line = ""; }
        line += segment;
      }
    }
    if (line) emit(line);
  }
};

const renderReportText = (pdf, text) => {
  const lines = plainMarkdown(text).split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pdf.moveDown(0.45);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      if (pdf.y > pdf.page.height - pdf.page.margins.bottom - 85) pdf.addPage();
      pdf
        .moveDown(0.35)
        .font("Rashtram-Bold")
        .fontSize(heading[1].length === 1 ? 16 : 13)
        .fillColor("#8f1d2c")
        .text(heading[2], { lineGap: 2, lineBreak: true, width: 487 })
        .moveDown(0.2);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      pdf
        .font("Rashtram-Regular")
        .fontSize(10.5)
        .fillColor("#29312d");
      writeWrappedText(pdf, `• ${bullet[1]}`, { indent: 12, lineGap: 3 });
      continue;
    }
    pdf
      .font("Rashtram-Regular")
      .fontSize(10.5)
      .fillColor("#29312d");
    writeWrappedText(pdf, line, { lineGap: 3 });
  }
};

const createResearchBriefPdf = ({
  title,
  documentType,
  reportText,
  sources = [],
  generatedAt = new Date(),
  completeEvidence = false,
  sourcesOnNewPage = true,
}) => new Promise((resolve, reject) => {
  const pdf = new PDFDocument({
    size: "A4",
    // Reserve a separate footer band; the footer baseline is at y=775.
    margins: { top: 54, right: 54, bottom: 88, left: 54 },
    bufferPages: true,
    info: {
      Title: `${title || "Research report"} — Rashtram AI`,
      Author: "Rashtram AI",
      Subject: "Evidence-grounded research brief",
    },
  });
  configureUnicodeFonts(pdf);
  const buffers = [];
  pdf.on("data", (chunk) => buffers.push(chunk));
  pdf.on("end", () => resolve(Buffer.concat(buffers)));
  pdf.on("error", reject);

  pdf
    .font("Rashtram-Bold")
    .fontSize(10)
    .fillColor("#8f1d2c")
    .text("RASHTRAM AI · EVIDENCE-GROUNDED RESEARCH", { characterSpacing: 1.1 });
  pdf.moveDown(0.8);
  pdf
    .font("Rashtram-Display")
    .fontSize(23)
    .fillColor("#8f1d2c")
    .text(compact(title) || "Research brief", { lineGap: 3 });
  pdf.moveDown(0.45);
  pdf
    .font("Rashtram-Regular")
    .fontSize(9)
    .fillColor("#706a61")
    .text([
      documentType ? `Document type: ${documentType}` : null,
      `Generated: ${new Date(generatedAt).toISOString()}`,
    ].filter(Boolean).join("  ·  "));
  pdf.moveDown(0.8);
  pdf.strokeColor("#d9cfc2").lineWidth(0.8).moveTo(54, pdf.y).lineTo(541, pdf.y).stroke();
  pdf.moveDown(1);
  renderReportText(pdf, reportText);

  const citedSources = (Array.isArray(sources) ? sources : [])
    .filter((source) => source && typeof source === "object")
    .slice(0, completeEvidence ? undefined : 20);
  if (citedSources.length) {
    if (sourcesOnNewPage || pdf.y > pdf.page.height - pdf.page.margins.bottom - 120) pdf.addPage();
    else pdf.moveDown(1);
    pdf
      .font("Rashtram-Display")
      .fontSize(18)
      .fillColor("#8f1d2c")
      .text("Cited evidence");
    pdf.moveDown(0.7);
    citedSources.forEach((source, index) => {
      if (pdf.y > pdf.page.height - pdf.page.margins.bottom - 65) pdf.addPage();
      const location = [
        source.documentTitle,
        source.page ? `Page ${source.page}` : null,
        source.section ? `Section ${source.section}` : null,
        source.clause ? `Clause ${source.clause}` : null,
      ].filter(Boolean).join(" · ");
      pdf
        .font("Rashtram-Bold")
        .fontSize(9.5)
        .fillColor("#8f1d2c");
      writeWrappedText(pdf, `${source.citationId || index + 1}. ${location || "Retrieved source passage"}`, { lineGap: 1 });
      if (source.content) {
        pdf
          .font("Rashtram-Regular")
          .fontSize(9)
          .fillColor("#29312d");
        writeWrappedText(pdf, completeEvidence ? compact(source.content) : compact(source.content).slice(0, 900), { lineGap: 2 });
      }
      const sourceUrl = source.sourceUrl || source.pdfUrl;
      if (sourceUrl) {
        pdf
          .font("Rashtram-Regular")
          .fontSize(8)
          .fillColor("#874047");
        writeWrappedText(pdf, completeEvidence ? String(sourceUrl) : String(sourceUrl).slice(0, 1_500), { link: sourceUrl, underline: true });
      }
      pdf.moveDown(0.7);
    });
  }

  const pageRange = pdf.bufferedPageRange();
  for (let index = 0; index < pageRange.count; index += 1) {
    pdf.switchToPage(index);
    const bodyBottomMargin = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf
      .font("Rashtram-Regular")
      .fontSize(8)
      .fillColor("#8a8277")
      .text(
        `Rashtram AI · Page ${index + 1} of ${pageRange.count}`,
        54,
        775,
        { align: "center", width: 487, lineBreak: false },
      );
    pdf.page.margins.bottom = bodyBottomMargin;
  }
  pdf.end();
});

module.exports = {
  createResearchBriefPdf,
  isExportableReportMessage,
  isPdfExportRequest,
  plainMarkdown,
  safeFilePart,
};
