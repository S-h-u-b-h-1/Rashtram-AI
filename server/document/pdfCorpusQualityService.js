const { aggregateDocumentQuality, evaluateTextQuality, QUALITY } = require("../lib/pdfTextQuality");

const severityForDocument = (pages = []) => {
  const aggregate = aggregateDocumentQuality(pages);
  const bad = Number(aggregate.counts.CORRUPTED || 0) + Number(aggregate.counts.UNRECOVERABLE || 0);
  const suspicious = Number(aggregate.counts.SUSPICIOUS || 0);
  const badRatio = aggregate.totalPages ? bad / aggregate.totalPages : 1;
  if (!aggregate.usablePages || badRatio >= 0.5 || aggregate.averageScore < 0.28) return "SEVERE";
  if (bad > 0 || badRatio >= 0.1 || aggregate.averageScore < 0.62) return "LIKELY_CORRUPTED";
  if (suspicious > 0 || aggregate.averageScore < 0.82) return "SUSPICIOUS";
  return "GOOD";
};

const qualityPageKey = (row) => Number(row.metadata_json?.pageStart || row.chunk_index || 0);

const summarizeDocuments = (rows = []) => {
  const grouped = new Map();
  for (const row of rows) {
    const key = String(row.document_id);
    if (!grouped.has(key)) grouped.set(key, { document: row, pages: new Map(), chunks: 0 });
    const group = grouped.get(key);
    const quality = evaluateTextQuality(row.original_text || row.translated_text || "");
    const page = qualityPageKey(row);
    const existing = group.pages.get(page);
    if (!existing || quality.score < existing.score) group.pages.set(page, { page, ...quality });
    group.chunks += 1;
  }
  return [...grouped.values()].map(({ document, pages, chunks }) => {
    const results = [...pages.values()];
    const aggregate = aggregateDocumentQuality(results);
    const severity = severityForDocument(results);
    const extractionMethod = document.extraction_method || document.metadata_json?.extractionMethod || "unknown";
    const active = Boolean(document.user_used || document.comparison_used);
    const primary = ["bill", "act", "gazette", "notification", "rule", "regulation", "order", "circular"]
      .includes(String(document.document_type || "").toLowerCase());
    const priority = active ? "P0" : primary || Number(document.year) >= new Date().getUTCFullYear() - 2 ? "P1" : "P2";
    return {
      id: String(document.document_id),
      type: document.document_type,
      title: document.title,
      source: document.source_name || "unknown",
      sourceUrl: document.source_url || null,
      pdfUrl: document.pdf_url || null,
      language: document.language || "und",
      year: document.year || null,
      extractionMethod,
      ocrUsed: Boolean(document.ocr_used),
      chunks,
      pagesEvaluated: results.length,
      severity,
      priority,
      mixedQuality: aggregate.usablePages > 0 && aggregate.failedPages.length > 0,
      ...aggregate,
      diagnosticPages: results
        .filter((page) => page.quality !== QUALITY.GOOD)
        .sort((left, right) => left.score - right.score)
        .slice(0, 12)
        .map((page) => ({ page: page.page, quality: page.quality, score: page.score, reasons: page.reasons })),
    };
  }).sort((left, right) => {
    const priority = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const severity = { SEVERE: 0, LIKELY_CORRUPTED: 1, SUSPICIOUS: 2, GOOD: 3 };
    return priority[left.priority] - priority[right.priority] ||
      severity[left.severity] - severity[right.severity] || left.averageScore - right.averageScore;
  });
};

const increment = (object, key) => { object[key || "unknown"] = (object[key || "unknown"] || 0) + 1; };
const aggregateAudit = (documents = []) => {
  const counts = { total: documents.length, good: 0, suspicious: 0, likelyCorrupted: 0, severelyCorrupted: 0, mixedQuality: 0 };
  const breakdown = { source: {}, documentType: {}, language: {}, year: {}, extractor: {}, extractionMode: {} };
  const queue = { P0: 0, P1: 0, P2: 0, P3: 0 };
  documents.forEach((document) => {
    if (document.severity === "GOOD") counts.good += 1;
    else if (document.severity === "SUSPICIOUS") counts.suspicious += 1;
    else if (document.severity === "LIKELY_CORRUPTED") counts.likelyCorrupted += 1;
    else counts.severelyCorrupted += 1;
    if (document.mixedQuality) counts.mixedQuality += 1;
    queue[document.priority] += document.severity === "GOOD" ? 0 : 1;
    increment(breakdown.source, document.source);
    increment(breakdown.documentType, document.type);
    increment(breakdown.language, document.language);
    increment(breakdown.year, String(document.year || "unknown"));
    increment(breakdown.extractor, document.extractionMethod);
    increment(breakdown.extractionMode, document.ocrUsed ? "ocr" : "native");
  });
  return { counts, queue, breakdown };
};

module.exports = { aggregateAudit, severityForDocument, summarizeDocuments };
