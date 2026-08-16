const PDFDocument = require("pdfkit");

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
  const requestsFile = /\b(pdf|download|downloadable|export)\b/.test(text);
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
      pdf
        .moveDown(0.35)
        .font("Helvetica-Bold")
        .fontSize(heading[1].length === 1 ? 16 : 13)
        .fillColor("#8f1d2c")
        .text(heading[2], { lineGap: 2 })
        .moveDown(0.2);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      pdf
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor("#29312d")
        .text(`• ${bullet[1]}`, { indent: 12, lineGap: 3 });
      continue;
    }
    pdf
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor("#29312d")
      .text(line, { lineGap: 3 });
  }
};

const createResearchBriefPdf = ({
  title,
  documentType,
  reportText,
  sources = [],
  generatedAt = new Date(),
}) => new Promise((resolve, reject) => {
  const pdf = new PDFDocument({
    size: "A4",
    margins: { top: 54, right: 54, bottom: 54, left: 54 },
    bufferPages: true,
    info: {
      Title: `${title || "Research report"} — Rashtram AI`,
      Author: "Rashtram AI",
      Subject: "Evidence-grounded research brief",
    },
  });
  const buffers = [];
  pdf.on("data", (chunk) => buffers.push(chunk));
  pdf.on("end", () => resolve(Buffer.concat(buffers)));
  pdf.on("error", reject);

  pdf
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#8f1d2c")
    .text("RASHTRAM AI · EVIDENCE-GROUNDED RESEARCH", { characterSpacing: 1.1 });
  pdf.moveDown(0.8);
  pdf
    .font("Times-Bold")
    .fontSize(23)
    .fillColor("#8f1d2c")
    .text(compact(title) || "Research brief", { lineGap: 3 });
  pdf.moveDown(0.45);
  pdf
    .font("Helvetica")
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
    .slice(0, 20);
  if (citedSources.length) {
    pdf.addPage();
    pdf
      .font("Times-Bold")
      .fontSize(18)
      .fillColor("#8f1d2c")
      .text("Cited evidence");
    pdf.moveDown(0.7);
    citedSources.forEach((source, index) => {
      const location = [
        source.documentTitle,
        source.page ? `Page ${source.page}` : null,
        source.section ? `Section ${source.section}` : null,
        source.clause ? `Clause ${source.clause}` : null,
      ].filter(Boolean).join(" · ");
      pdf
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor("#8f1d2c")
        .text(`${index + 1}. ${location || "Retrieved source passage"}`);
      if (source.content) {
        pdf
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#29312d")
          .text(compact(source.content).slice(0, 900), { lineGap: 2 });
      }
      const sourceUrl = source.sourceUrl || source.pdfUrl;
      if (sourceUrl) {
        pdf
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#874047")
          .text(String(sourceUrl).slice(0, 1_500), { link: sourceUrl, underline: true });
      }
      pdf.moveDown(0.7);
    });
  }

  const pageRange = pdf.bufferedPageRange();
  for (let index = 0; index < pageRange.count; index += 1) {
    pdf.switchToPage(index);
    pdf
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#8a8277")
      .text(
        `Rashtram AI · Page ${index + 1} of ${pageRange.count}`,
        54,
        775,
        { align: "center", width: 487, lineBreak: false },
      );
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
