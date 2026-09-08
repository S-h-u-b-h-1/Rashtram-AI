const express = require("express");
const { query } = require("../db");
const { getSourceContext } = require("../research/sourceService");
const { generatePolicyDraft } = require("../lib/vectordb");
const {
  mergePassagesByChunk,
  rerankPassages,
  retrieveDocumentContext,
  retrieveFtsPassages,
  retrieveLocalTextPassages,
} = require("../document/documentResearchService");
const { sanitizeProviderError } = require("../lib/providerErrorSanitizer");
const { generationLimiter } = require("../middleware/security");
const { completeSSE, errorSSE, sendSSE, startSSE } = require("../lib/sse");
const { sendError } = require("../lib/httpResponse");
const {
  groundedDraftFallback,
  policyDraftMarkdownToCanonical,
  policyDraftToMarkdown,
} = require("./policyDraftService");
const { buildPolicyDraftDocx } = require("./policyDraftDocxService");

const router = express.Router();
const MAX_DOCUMENTS = 8;
const MAX_SOURCES = 20;
const MAX_CONTEXT_CHARS = 28_000;
const DRAFT_PASSAGES_PER_DOCUMENT = 6;

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
  draft: row.draft_json || {},
  draftText: row.draft_text || "",
  citations: row.citations_json || [],
  status: row.status,
  errorMessage: row.error_message || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const loadLexicalDraftPassages = async (documentId, objective) => {
  const fts = await retrieveFtsPassages(documentId, objective, 12);
  if (fts.length >= DRAFT_PASSAGES_PER_DOCUMENT) {
    return rerankPassages(fts, objective, { topK: DRAFT_PASSAGES_PER_DOCUMENT });
  }
  const local = await retrieveLocalTextPassages(documentId, objective, 12);
  return rerankPassages(
    mergePassagesByChunk(fts, local),
    objective,
    { topK: DRAFT_PASSAGES_PER_DOCUMENT },
  );
};

const loadCatalogueContext = async (ids, objective, userId) => {
  if (!ids.length) return { context: "", citations: [], documents: [] };
  const rows = await query(
    `SELECT d.id, d.title, d.document_type, d.canonical_source,
            d.source_name, d.canonical_url, d.source_url, d.authority,
            d.ministry, d.publication_date,
            LEFT(COALESCE(a.english_summary, ''), 1600) AS english_summary,
            state.search_ready, state.semantic_ready, state.chunks_count,
            state.retrieval_verified, state.retrieval_verified_at
       FROM legislative_documents d
       JOIN documents catalogue_document ON catalogue_document.id = d.id
       JOIN document_processing_state state ON state.document_id = d.id
       LEFT JOIN document_text_artifacts a ON a.document_id = d.id
      WHERE d.id = ANY($1::BIGINT[])
        AND catalogue_document.visibility_status = 'public'
        AND catalogue_document.research_ready = TRUE
        AND state.search_ready = TRUE
        AND state.text_ready = TRUE
        AND state.processing_status = 'ready'
        AND state.extraction_status = 'ready'
        AND state.chunking_status = 'ready'
        AND state.chunks_count > 0
        AND (
          (state.failure_code IS NULL
            AND NULLIF(BTRIM(COALESCE(state.error_message, '')), '') IS NULL)
          OR state.failure_code IN ('EMBEDDING_PROVIDER_ERROR', 'VECTOR_STORE_ERROR')
        )
        AND EXISTS (
          SELECT 1 FROM document_text_chunks usable_chunk
          WHERE usable_chunk.document_id = d.id
            AND LENGTH(BTRIM(COALESCE(usable_chunk.original_text, usable_chunk.translated_text, ''))) > 0
        )
      ORDER BY array_position($1::BIGINT[], d.id)
      LIMIT ${MAX_DOCUMENTS}`,
    [ids],
  );
  if (rows.rows.length !== ids.length) {
    const error = new Error(
      "One or more selected catalogue documents are no longer ready to use. Refresh the references and choose a Ready to use document.",
    );
    error.status = 422;
    throw error;
  }
  const loaded = await Promise.all(rows.rows.map(async (row) => {
    let retrieval;
    if (row.semantic_ready) {
      try {
        retrieval = await retrieveDocumentContext(
          row.document_type,
          row.id,
          objective,
          {
            topK: DRAFT_PASSAGES_PER_DOCUMENT,
            vectorTimeBudgetMs: 600,
            accountId: userId,
            document: row,
          },
        );
      } catch (error) {
        console.warn(`Draft hybrid retrieval degraded for ${row.id}: ${error.message}`);
      }
    }
    const passages = retrieval?.passages?.length
      ? retrieval.passages.slice(0, DRAFT_PASSAGES_PER_DOCUMENT)
      : await loadLexicalDraftPassages(row.id, objective);
    if (!passages.length) {
      const error = new Error(`${row.title} no longer has usable drafting passages.`);
      error.status = 422;
      throw error;
    }
    const documentLabel = `[Catalogue document: ${row.title}]`;
    const summary = String(row.english_summary || "").replace(/\s+/g, " ").trim();
    const evidence = [
      summary ? `[Catalogue summary: ${row.title}]\n${summary}` : "",
      ...passages.map((passage, index) => {
        const content = String(passage.content || "").replace(/\s+/g, " ").trim().slice(0, 1_100);
        return content ? `${documentLabel} Passage ${index + 1}\n${content}` : "";
      }),
    ].filter(Boolean).join("\n\n");
    return { evidence, citation: {
      sourceType: "catalogue",
      documentId: String(row.id),
      title: row.title,
      documentType: row.document_type,
      authority: row.authority || row.canonical_source || row.source_name,
      sourceUrl: row.canonical_url || row.source_url || null,
      ministry: row.ministry || null,
      publicationDate: row.publication_date || null,
      retrievalMode: retrieval?.retrievalMode || "local_text",
      passageCount: passages.length,
    } };
  }));
  return {
    context: loaded.map((item) => item.evidence).join("\n\n").slice(0, MAX_CONTEXT_CHARS),
    citations: loaded.map((item) => item.citation),
    documents: rows.rows,
  };
};

const evidenceLabelsFromContext = (context) => [...new Set(
  String(context || "").match(/\[(?:Catalogue document|Catalogue summary|User source):[^\]]+\]/g) || [],
)];

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

router.get("/:draftId/export.docx", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM policy_drafts WHERE id = $1 AND user_id = $2 AND status = 'ready' LIMIT 1`,
      [req.params.draftId, req.user.id],
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Ready policy draft not found." });
    const buffer = await buildPolicyDraftDocx({
      draft: row.draft_json,
      citations: row.citations_json || [],
      brief: row.brief_json || {},
      createdAt: row.created_at,
    });
    const name = String(row.title || "rashtram-policy-draft")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${name || "rashtram-policy-draft"}.docx"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(buffer);
  } catch (error) {
    return sendError(res, error, "Policy DOCX could not be created");
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
    const [catalogue, userSources] = await Promise.all([
      loadCatalogueContext(documentIds, brief.objective, req.user.id),
      getSourceContext(req.user.id, sourceIds, brief.objective),
    ]);
    const context = [
      catalogue.context,
      userSources.context,
    ].filter(Boolean).join("\n\n").slice(0, MAX_CONTEXT_CHARS);
    if (!context) {
      return res.status(422).json({ error: "Select at least one prepared catalogue document, stored document summary, or study source." });
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
    sendSSE(res, { type: "status", status: "Preparing evidence…" });
    const prompt = [
      `Policy title: ${title}`,
      `Problem or objective: ${brief.objective}`,
      brief.audience ? `Target audience: ${brief.audience}` : "",
      brief.geography ? `Geography or jurisdiction: ${brief.geography}` : "",
      brief.requirements ? `Researcher requirements: ${brief.requirements}` : "",
    ].filter(Boolean).join("\n");
    try {
      let markdown = "";
      let generationMode = "generated";
      try {
        const stream = await generatePolicyDraft(prompt, context, {
          responseLanguage: brief.responseLanguage,
        });
        sendSSE(res, { type: "status", status: "Writing your policy draft…" });
        for await (const chunk of stream) {
          if (res.destroyed || res.writableEnded) break;
          const content = typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
          if (!content) continue;
          markdown += content;
          sendSSE(res, { type: "content", content });
        }
        if (!markdown.trim()) throw new Error("The policy draft provider returned no text.");
      } catch (generationError) {
        if (markdown.trim()) throw generationError;
        const fallback = groundedDraftFallback({
          brief,
          title,
          evidenceLabels: evidenceLabelsFromContext(context),
          reason: generationError.message,
        });
        markdown = policyDraftToMarkdown(fallback);
        generationMode = "grounded_fallback";
        sendSSE(res, { type: "status", status: "A grounded fallback draft was prepared." });
        sendSSE(res, { type: "content", content: markdown });
      }
      const canonicalDraft = policyDraftMarkdownToCanonical(markdown, title);
      await query(
        `UPDATE policy_drafts SET draft_text = $1, draft_json = $2::jsonb,
           status = 'ready', error_message = NULL, updated_at = NOW()
         WHERE id = $3 AND user_id = $4`,
        [markdown, JSON.stringify(canonicalDraft), draftId, req.user.id],
      );
      completeSSE(res, {
        persisted: true,
        draftId: String(draftId),
        generationMode,
      });
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
