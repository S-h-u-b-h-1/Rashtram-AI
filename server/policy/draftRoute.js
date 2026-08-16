const express = require("express");
const { query } = require("../db");
const DocumentRepository = require("../document/DocumentRepository");
const { getSourceContext } = require("../research/sourceService");
const { generatePolicyDraft } = require("../lib/vectordb");
const { sanitizeProviderError } = require("../lib/providerErrorSanitizer");
const { generationLimiter } = require("../middleware/security");
const { completeSSE, errorSSE, sendSSE, startSSE } = require("../lib/sse");
const { sendError } = require("../lib/httpResponse");

const router = express.Router();
const MAX_DOCUMENTS = 8;
const MAX_SOURCES = 20;
const MAX_CONTEXT_CHARS = 48_000;

const safeIds = (values, maximum) =>
  [...new Set((Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0))]
    .slice(0, maximum);

const mapDraft = (row) => ({
  id: String(row.id),
  title: row.title,
  brief: row.brief_json || {},
  documentIds: row.document_ids_json || [],
  sourceIds: row.source_ids_json || [],
  draftText: row.draft_text || "",
  citations: row.citations_json || [],
  status: row.status,
  errorMessage: row.error_message || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const loadCatalogueContext = async (ids) => {
  if (!ids.length) return { context: "", citations: [], documents: [] };
  const rows = await query(
    `SELECT d.id, d.title, d.document_type, d.canonical_source,
            d.source_name, d.canonical_url, d.source_url, d.authority,
            d.ministry, d.publication_date,
            LEFT(COALESCE(a.original_text, ''), 12000) AS original_text,
            LEFT(COALESCE(a.english_summary, ''), 3200) AS english_summary
       FROM legislative_documents d
       LEFT JOIN document_text_artifacts a ON a.document_id = d.id
      WHERE d.id = ANY($1::BIGINT[])
        AND d.research_ready = TRUE
      ORDER BY array_position($1::BIGINT[], d.id)
      LIMIT ${MAX_DOCUMENTS}`,
    [ids],
  );
  const context = [];
  const citations = [];
  for (const row of rows.rows) {
    const label = `[Catalogue document: ${row.title}]`;
    const evidence = String(row.original_text || row.english_summary || "")
      .replace(/\s+/g, " ")
      .trim();
    if (evidence) context.push(`${label}\n${evidence}`);
    citations.push({
      sourceType: "catalogue",
      documentId: String(row.id),
      title: row.title,
      documentType: row.document_type,
      authority: row.authority || row.canonical_source || row.source_name,
      sourceUrl: row.canonical_url || row.source_url || null,
      ministry: row.ministry || null,
      publicationDate: row.publication_date || null,
    });
  }
  return {
    context: context.join("\n\n").slice(0, MAX_CONTEXT_CHARS),
    citations,
    documents: rows.rows,
  };
};

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const result = await query(
      `SELECT * FROM policy_drafts
        WHERE user_id = $1
        ORDER BY updated_at DESC, id DESC
        LIMIT $2`,
      [req.user.id, limit],
    );
    return res.json({ drafts: result.rows.map(mapDraft) });
  } catch (error) {
    return sendError(res, error, "Policy drafts could not be loaded");
  }
});

router.get("/:draftId", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM policy_drafts WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.draftId, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Policy draft not found." });
    return res.json({ draft: mapDraft(result.rows[0]) });
  } catch (error) {
    return sendError(res, error, "Policy draft could not be loaded");
  }
});

router.post("/generate", generationLimiter, async (req, res) => {
  const brief = {
    objective: String(req.body?.objective || "").trim().slice(0, 1_500),
    audience: String(req.body?.audience || "").trim().slice(0, 500),
    geography: String(req.body?.geography || "").trim().slice(0, 500),
    requirements: String(req.body?.requirements || "").trim().slice(0, 2_000),
    title: String(req.body?.title || "").trim().slice(0, 240),
    responseLanguage: String(req.body?.responseLanguage || "English").slice(0, 40),
  };
  if (!brief.objective) return res.status(400).json({ error: "Describe the policy problem or objective first." });

  try {
    const documentIds = safeIds(req.body?.documentIds, MAX_DOCUMENTS);
    const sourceIds = safeIds(req.body?.sourceIds, MAX_SOURCES);
    const catalogue = await loadCatalogueContext(documentIds);
    const userSources = await getSourceContext(req.user.id, sourceIds, brief.objective);
    const context = [
      catalogue.context,
      userSources.context,
    ].filter(Boolean).join("\n\n").slice(0, MAX_CONTEXT_CHARS);
    if (!context) {
      return res.status(422).json({ error: "Select at least one research-ready catalogue document or study source." });
    }
    const citations = [...catalogue.citations, ...userSources.sources.map((source) => ({
      sourceType: "user_source",
      sourceId: source.sourceId,
      title: source.documentTitle,
      sourceUrl: source.sourceUrl || null,
      fileName: source.fileName || null,
      passage: source.passage,
    }))];
    const title = brief.title || `Policy draft: ${brief.objective.slice(0, 100)}`;
    const inserted = await query(
      `INSERT INTO policy_drafts
         (user_id, title, brief_json, document_ids_json, source_ids_json, citations_json, status)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, 'processing')
       RETURNING id`,
      [req.user.id, title, JSON.stringify(brief), JSON.stringify(documentIds), JSON.stringify(sourceIds), JSON.stringify(citations)],
    );
    const draftId = inserted.rows[0].id;
    startSSE(res);
    sendSSE(res, {
      type: "meta",
      draftId: String(draftId),
      title,
      citations,
      metadata: { documentCount: catalogue.citations.length, sourceCount: userSources.sources.length },
    });
    const prompt = [
      `Policy title: ${title}`,
      `Problem or objective: ${brief.objective}`,
      brief.audience ? `Target audience: ${brief.audience}` : "",
      brief.geography ? `Geography or jurisdiction: ${brief.geography}` : "",
      brief.requirements ? `Researcher requirements: ${brief.requirements}` : "",
    ].filter(Boolean).join("\n");
    let draftText = "";
    try {
      const stream = await generatePolicyDraft(prompt, context, { responseLanguage: brief.responseLanguage });
      for await (const content of stream) {
        if (!content) continue;
        draftText += content;
        sendSSE(res, { type: "content", content });
      }
      await query(
        `UPDATE policy_drafts SET draft_text = $1, status = 'ready', error_message = NULL, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
        [draftText, draftId, req.user.id],
      );
      completeSSE(res, { persisted: true, draftId: String(draftId) });
    } catch (error) {
      const safeError = sanitizeProviderError(error);
      await query(
        `UPDATE policy_drafts SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
        [safeError, draftId, req.user.id],
      ).catch(() => undefined);
      errorSSE(res, new Error("Policy drafting was interrupted. Please try again."));
    }
  } catch (error) {
    if (!res.headersSent) return sendError(res, error, "Policy draft could not be prepared");
    errorSSE(res, error);
  }
});

router.delete("/:draftId", async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM policy_drafts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.draftId, req.user.id],
    );
    return res.json({ deleted: Boolean(result.rows[0]) });
  } catch (error) {
    return sendError(res, error, "Policy draft could not be deleted");
  }
});

module.exports = router;
