const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { poolConfig } = require("../lib/database/connectionConfig");
const { createResearchBriefPdf } = require("../document/reportPdfService");
const { comparisonAsMarkdown } = require("../document/documentComparisonService");
const [envPath, outputPath, ...ids] = process.argv.slice(2);
if (!outputPath || ids.length !== 3 || ids.some((id) => !/^\d+$/.test(id))) throw new Error("Supply an env file, output directory and exactly three account-verified comparison IDs.");
const env = require("dotenv").parse(fs.readFileSync(envPath));
const pool = new Pool(poolConfig(env.DATABASE_URL));
(async () => {
  fs.mkdirSync(outputPath, { recursive: true });
  const rows = (await pool.query("SELECT id, title, result_json, created_at FROM document_comparisons WHERE id = ANY($1::BIGINT[]) ORDER BY id", [ids])).rows;
  if (rows.length !== 3) throw new Error("One or more requested saved comparisons are unavailable.");
  for (const row of rows) {
    const result = row.result_json || {};
    const comparison = { ...row, result, createdAt: row.created_at };
    const pdf = await createResearchBriefPdf({ title: row.title, reportText: comparisonAsMarkdown(comparison), generatedAt: row.created_at,
      completeEvidence: true, sources: (result.citations || []).map((citation) => ({ citationId: citation.id || citation.citationId,
        documentTitle: citation.documentTitle, page: citation.page ?? citation.pageStart, section: citation.sectionTitle || citation.sectionId,
        content: citation.snippet || citation.content, sourceUrl: citation.canonicalSourceUrl || citation.sourceUrl || citation.pdfUrl })) });
    fs.writeFileSync(path.join(outputPath, `comparison-${row.id}.pdf`), pdf);
    console.log(JSON.stringify({ id: row.id, bytes: pdf.length, mode: result.generationMode, validation: result.quality?.outputValidation, sources: result.citations?.length || 0 }));
  }
  const fixture = await createResearchBriefPdf({ title: "हिन्दी और English — ₹1,000 • Policy comparison", completeEvidence: true,
    reportText: "# निष्कर्ष / Findings\n\nभारत में डेटा संरक्षण के लिए consent आवश्यक है। [C1]\n\n" + "- Long finding retained: obligations differ across the two instruments [C1, C2].\n".repeat(70),
    sources: [{ citationId: "C1", documentTitle: "भारतीय नीति", page: 2, content: "हिन्दी पाठ और English source evidence.", sourceUrl: "https://example.com/source" }] });
  fs.writeFileSync(path.join(outputPath, "unicode-long-fixture.pdf"), fixture);
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
