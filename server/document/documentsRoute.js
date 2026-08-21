const express = require("express");
const crypto = require("node:crypto");
const { generationLimiter } = require("../middleware/security");
const { query } = require("../db");
const DocumentService = require("./DocumentService");
const DocumentRepository = require("./DocumentRepository");
const {
  retrieveDocumentContext,
  getTextArtifact,
} = require("./documentResearchService");
const { planQuery } = require("../retrieval/queryPlanner");
const { retrievalConfig } = require("../retrieval/retrievalConfig");
const { selectContextPassages } = require("../retrieval/contextBuilder");
const {
  SUFFICIENCY_LEVELS,
  assessEvidenceSufficiency,
  buildAbstentionResponse,
  buildGroundedExtractiveAnswer,
  summarizeVerification,
  verifyAndRepairAnswer,
} = require("../retrieval/evidenceSafetyService");
const { getRelationshipContext } = require("../graph/knowledgeGraphService");
const { generateResponse } = require("../lib/vectordb");
const { sanitizeProviderError } = require("../lib/providerErrorSanitizer");
const {
  completeSSE,
  errorSSE,
  sendSSE,
  startSSE,
} = require("../lib/sse");
const {
  createComparison,
  deleteComparison,
  getComparison,
} = require("./documentComparisonService");
const {
  getComparisonRecommendations,
  getDocumentRecommendations,
} = require("./recommendationService");
const { getSourceContext } = require("../research/sourceService");
const {
  enqueueProcessing,
  prepareDocument,
} = require("./readinessService");
const { getDocumentReadiness } = require("./readinessContract");
const { sendError } = require("../lib/httpResponse");

const router = express.Router();

const normalizeChatIds = (value) => [
  ...new Set(
    (Array.isArray(value) ? value : String(value || "").split(","))
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ),
].slice(0, 5);

const selectionKey = (ids) =>
  [...ids].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  ).join(":");

const compactText = (value, maxLength = 1_000) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const responseChunks = (value, maximum = 160) => {
  const text = String(value || "");
  const chunks = [];
  let remaining = text;
  while (remaining) {
    if (remaining.length <= maximum) {
      chunks.push(remaining);
      break;
    }
    const boundary = Math.max(
      remaining.lastIndexOf("\n", maximum),
      remaining.lastIndexOf(" ", maximum),
    );
    const end = boundary >= Math.floor(maximum * 0.55) ? boundary + 1 : maximum;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  return chunks;
};

const buildDocumentBriefContext = (document, artifact) => {
  if (!artifact?.englishSummary) return "";
  const sections = artifact.summarySections || {};
  return [
    `[Document brief: ${document.title}]`,
    compactText(artifact.englishSummary, 1_600),
    sections.implementation
      ? `Implementation: ${compactText(sections.implementation, 500)}`
      : "",
    sections.affected_authorities
      ? `Affected authorities: ${compactText(sections.affected_authorities, 500)}`
      : "",
  ].filter(Boolean).join("\n");
};

const buildExtractiveMultiDocumentFallback = (message, sources) => {
  const lines = sources
    .slice(0, 6)
    .map((source) => {
      const snippet = String(source.content || "")
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 480);
      return `- ${source.documentTitle || `Document ${source.documentId}`} [Passage ${source.passage}]: ${snippet}`;
    })
    .filter((line) => line.length > 16);
  return [
    "AI generation is temporarily unavailable, so Rashtram AI is answering from retrieved comparison passages only.",
    "",
    `Question: ${message}`,
    "",
    "Grounded extractive answer:",
    lines.length ? lines.join("\n") : "- No suitable passage excerpt was available.",
  ].join("\n");
};

router.get("/", async (req, res) => {
  try {
    const result = await DocumentService.find(req.query);
    const filters = await DocumentService.getFilterOptions(req.query);
    return res.json({ ...result, filters, source: "universal-repository" });
  } catch (error) {
    return sendError(res, error, "Universal document query failed");
  }
});

router.get("/search", async (req, res) => {
  try {
    const result = await DocumentService.search({
      ...req.query,
      search: req.query.q || req.query.search,
    });
    return res.json({ ...result, source: "universal-search" });
  } catch (error) {
    return sendError(res, error, "Universal document search failed");
  }
});

router.get("/filters", async (req, res) => {
  try {
    return res.json(await DocumentService.getFilterOptions(req.query));
  } catch (error) {
    return sendError(res, error, "Universal document filters failed");
  }
});

router.post("/recommend-for-comparison", async (req, res) => {
  try {
    return res.json(
      await getComparisonRecommendations(req.user.id, req.body),
    );
  } catch (error) {
    return sendError(res, error, "Comparison recommendations failed");
  }
});

router.get("/chat/history", async (req, res) => {
  try {
    const ids = normalizeChatIds(req.query.ids);
    if (ids.length < 2) return res.json({ messages: [] });
    const result = await query(
      `SELECT messages, comparison_id, updated_at
       FROM multi_document_chats
       WHERE user_id = $1 AND selection_key = $2
       LIMIT 1`,
      [req.user.id, selectionKey(ids)],
    );
    const row = result.rows[0];
    return res.json({
      messages: row?.messages || [],
      comparisonId: row?.comparison_id ? String(row.comparison_id) : null,
      updatedAt: row?.updated_at || null,
    });
  } catch (error) {
    return sendError(res, error, "Cross-document history lookup failed");
  }
});

router.delete("/chat/history", async (req, res) => {
  try {
    const ids = normalizeChatIds(req.query.ids);
    if (ids.length < 2) {
      return res.status(400).json({ error: "At least two IDs are required." });
    }
    await query(
      `DELETE FROM multi_document_chats
       WHERE user_id = $1 AND selection_key = $2`,
      [req.user.id, selectionKey(ids)],
    );
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error, "Cross-document history clear failed");
  }
});

router.post("/compare", generationLimiter, async (req, res) => {
  try {
    const comparison = await createComparison(req.user.id, req.body);
    return res.status(201).json({
      comparison,
      comparisonId: comparison.id,
      documents: comparison.result.documents || [],
      summary: comparison.result.executiveSummary || "",
      ...comparison.result,
      recommendedDocuments: comparison.recommendedDocuments,
      createdAt: comparison.createdAt,
    });
  } catch (error) {
    return sendError(res, error, "Document comparison failed");
  }
});

router.get("/compare/:comparisonId", async (req, res) => {
  try {
    const comparison = await getComparison(
      req.user.id,
      req.params.comparisonId,
    );
    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found." });
    }
    return res.json({
      comparison,
      comparisonId: comparison.id,
      documents: comparison.result.documents || [],
      summary: comparison.result.executiveSummary || "",
      ...comparison.result,
      recommendedDocuments: comparison.recommendedDocuments,
      createdAt: comparison.createdAt,
    });
  } catch (error) {
    return sendError(res, error, "Document comparison lookup failed");
  }
});

router.delete("/compare/:comparisonId", async (req, res) => {
  try {
    const deleted = await deleteComparison(
      req.user.id,
      req.params.comparisonId,
    );
    return res.status(deleted ? 200 : 404).json({ deleted });
  } catch (error) {
    return sendError(res, error, "Document comparison delete failed");
  }
});

router.post("/chat", generationLimiter, async (req, res) => {
  try {
    const ids = normalizeChatIds(req.body.documentIds);
    const message = String(req.body.message || "").trim();
    const sourceIds = Array.isArray(req.body.sourceIds)
      ? req.body.sourceIds.slice(0, 20)
      : [];
    if (!ids.length || !message) {
      return res.status(400).json({
        error: "A message and one to five document IDs are required.",
      });
    }
    const documents = (
      await Promise.all(ids.map((id) => DocumentRepository.getById(id)))
    ).filter(Boolean);
    if (!documents.length) {
      return res.status(404).json({ error: "Documents not found." });
    }
    const passagesPerDocument = Math.max(
      2,
      Math.floor(12 / documents.length),
    );
    const plan = planQuery(message, {
      documentCount: documents.length,
      comparison: documents.length > 1,
    });
    const settings = retrievalConfig();
    const passageGroups = await Promise.all(
      documents.map(async (document) => {
        let graphLatencyMs = 0;
        const relationshipPromise = plan.useGraph
          ? (async () => {
              const startedAt = Date.now();
              try {
                return await getRelationshipContext(
                  document.id,
                  message,
                  settings.graphCandidates,
                );
              } finally {
                graphLatencyMs = Date.now() - startedAt;
              }
            })()
          : Promise.resolve({ context: "", sources: [], graphGrounded: false });
        const [retrieval, textArtifact, relationshipContext] = await Promise.all([
          retrieveDocumentContext(
            document.type,
            document.id,
            message,
            { topK: passagesPerDocument, plan, document },
          ),
          getTextArtifact(document.id),
          relationshipPromise,
        ]);
        return {
          document,
          passages: selectContextPassages(retrieval.passages, {
            tokenBudget: Math.floor(settings.contextTokenBudget / documents.length),
            perPassageChars: 1_400,
          }),
          textArtifact,
          relationshipContext,
          retrieval: {
            ...retrieval.diagnostics,
            timings: {
              ...retrieval.diagnostics.timings,
              graphMs: graphLatencyMs,
            },
          },
        };
      }),
    );
    let passageNumber = 0;
    const sources = passageGroups.flatMap(({ document, passages }) =>
      passages.map((passage) => ({
        ...passage,
        passage: ++passageNumber,
        documentId: document.id,
        documentType: document.type,
        documentTitle: document.title,
        sourceUrl: document.sourceUrl,
        pdfUrl: document.pdfUrl,
      })),
    );
    const userSourceContext = await getSourceContext(
      req.user.id,
      sourceIds,
      message,
    );
    const context = sources
      .map(
        (source) =>
          `[Passage ${source.passage}] ${source.documentTitle}\n${compactText(source.content, 1_000)}`,
      )
      .join("\n\n");
    const graphContext = passageGroups
      .map(({ document, relationshipContext }) => relationshipContext.context
        ? `Verified relationships for ${document.title}:\n${relationshipContext.context}`
        : "")
      .filter(Boolean)
      .join("\n\n");
    const graphSources = passageGroups.flatMap(({ document, relationshipContext }) =>
      relationshipContext.sources.map((source) => ({
        ...source,
        passage: ++passageNumber,
        documentId: source.documentId || document.id,
        documentTitle: source.documentTitle || document.title,
      })),
    );
    const combinedContext = [
      context,
      graphContext,
      userSourceContext.context,
    ].filter(Boolean).join("\n\n");
    const briefContext = passageGroups
      .map(({ document, textArtifact }) =>
        buildDocumentBriefContext(document, textArtifact),
      )
      .filter(Boolean)
      .join("\n\n");
    if (!combinedContext) {
      const error = new Error(
        "No indexed passages are available for the selected documents.",
      );
      error.status = 422;
      throw error;
    }

    graphSources.forEach((source) => sources.push(source));
    userSourceContext.sources.forEach((source) => sources.push(source));
    const verificationEvidence = [
      ...sources.filter((source) => !source.userSource),
      ...(userSourceContext.evidence || userSourceContext.sources),
    ];
    const sufficiency = assessEvidenceSufficiency(message, verificationEvidence, {
      queryType: plan.queryType,
      retrievalVerified: passageGroups.some(({ passages }) => passages.length > 0),
      minimumEvidence: Math.max(2, documents.length),
    });

    startSSE(res);
    sendSSE(res, {
      type: "meta",
      documents: documents.map(({ id, type, title }) => ({
        id,
        type,
        title,
      })),
      sources: sources.map((source) => ({
        ...source,
        content: source.content.slice(0, 360),
      })),
      metadata: {
        grounded: true,
        documentCount: documents.length,
        selectedSourceCount: userSourceContext.sources.length,
        graphSourceCount: graphSources.length,
        evidenceSufficiency: sufficiency,
        retrieval: passageGroups.map(({ document, retrieval }) => ({
          documentId: document.id,
          ...retrieval,
        })),
      },
    });
    const responseLanguage = req.body.responseLanguage || "Auto";
    let fullResponse = "";
    let generationMode = "ai";
    let providerError = null;
    let verification = null;
    if ([
      SUFFICIENCY_LEVELS.INSUFFICIENT,
      SUFFICIENCY_LEVELS.CONFLICTING,
    ].includes(sufficiency.level)) {
      fullResponse = buildAbstentionResponse(sufficiency, {
        documentTitles: documents.map((document) => document.title),
      });
      generationMode = "evidence_abstention";
    } else {
      try {
        const stream = await generateResponse(message, [briefContext, combinedContext].filter(Boolean).join("\n\n"), {
          responseLanguage,
        });
        let generatedAnswer = "";
        for await (const chunk of stream) {
          if (res.destroyed || res.writableEnded) break;
          const content =
            typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
          if (content) generatedAnswer += content;
        }
        verification = await verifyAndRepairAnswer(generatedAnswer, verificationEvidence, {
          sufficiency,
          documentTitles: documents.map((document) => document.title),
        });
        fullResponse = verification.answer;
        generationMode = verification.abstained ? "verification_abstention" : "ai_verified";
      } catch (generationError) {
        providerError = sanitizeProviderError(generationError);
        console.warn(
          `Cross-document chat generation unavailable; using extractive fallback: ${providerError}`,
        );
        fullResponse = buildGroundedExtractiveAnswer(message, verificationEvidence);
        generationMode = "extractive_fallback";
      }
    }
    for (const content of responseChunks(fullResponse)) {
      if (res.destroyed || res.writableEnded) break;
      sendSSE(res, { type: "content", content });
    }
    sendSSE(res, {
      type: "meta",
      metadata: {
        generationMode,
        providerError,
        evidenceSufficiency: sufficiency,
        verification: verification
          ? summarizeVerification(verification)
          : {
              mode: generationMode,
              unsupportedAfterRepair: 0,
              abstained: generationMode === "evidence_abstention",
            },
      },
    });
    if (res.destroyed || res.writableEnded) return undefined;
    const now = new Date().toISOString();
    const persistedMessages = [
      {
        _id: crypto.randomUUID(),
        sender: "user",
        text: message,
        timestamp: now,
        sources: [],
      },
      {
        _id: crypto.randomUUID(),
        sender: "assistant",
        text: fullResponse,
        timestamp: now,
        sources,
        metadata: {
          grounded: true,
          documentIds: ids,
          responseLanguage,
          generationMode,
          providerError,
          evidenceSufficiency: sufficiency,
          verification: verification
            ? summarizeVerification(verification)
            : { mode: generationMode },
        },
      },
    ];
    await query(
      `INSERT INTO multi_document_chats (
         user_id, selection_key, document_ids_json, comparison_id, messages
       )
       VALUES (
         $1, $2, $3::jsonb,
         (
           SELECT id FROM document_comparisons
           WHERE id::TEXT = $4 AND user_id = $1
         ),
         $5::jsonb
       )
       ON CONFLICT (user_id, selection_key)
       DO UPDATE SET
         messages = multi_document_chats.messages || EXCLUDED.messages,
         comparison_id = COALESCE(
           EXCLUDED.comparison_id,
           multi_document_chats.comparison_id
         ),
         updated_at = NOW()`,
      [
        req.user.id,
        selectionKey(ids),
        JSON.stringify(ids),
        String(req.body.comparisonId || ""),
        JSON.stringify(persistedMessages),
      ],
    );
    completeSSE(res, { persisted: true });
    return undefined;
  } catch (error) {
    console.error("Cross-document chat failed:", error);
    if (!res.headersSent) return sendError(res, error, "Cross-document chat failed");
    errorSSE(res, error);
    return undefined;
  }
});

router.get("/:id/summary", async (req, res) => {
  try {
    const summary = await DocumentService.getSummary(req.params.id, req.user.id);
    return res.json({ summary });
  } catch (error) {
    return sendError(res, error, "Universal document summary failed");
  }
});

router.get("/:id/readiness", async (req, res) => {
  try {
    const readiness = await getDocumentReadiness(req.params.id);
    if (!readiness) {
      return res.status(404).json({ error: "Document not found." });
    }
    const { document: _document, ...payload } = readiness;
    return res.json(payload);
  } catch (error) {
    return sendError(res, error, "Document readiness lookup failed");
  }
});

router.post("/:id/prepare", generationLimiter, async (req, res) => {
  try {
    const before = await getDocumentReadiness(req.params.id);
    if (!before) {
      return res.status(404).json({ error: "Document not found." });
    }
    if (before.comparisonReady) {
      const { document: _document, ...payload } = before;
      return res.json({ success: true, alreadyReady: true, readiness: payload });
    }
    if (!before.canPrepare) {
      const error = new Error(before.reason || "This document cannot be prepared.");
      error.status = 422;
      throw error;
    }
    const result = await prepareDocument(req.params.id, {
      userId: req.user.id,
      priority: 100,
      reason: "document_prepare",
    });
    const after = await getDocumentReadiness(req.params.id);
    const { document: _document, ...readiness } = after || {};
    return res.json({
      success: Boolean(after?.comparisonReady),
      ...result,
      readiness,
      researchReady: Boolean(after?.researchReady),
      comparisonReady: Boolean(after?.comparisonReady),
    });
  } catch (error) {
    return sendError(res, error, "Document preparation failed");
  }
});

router.get("/:id/relationships", async (req, res) => {
  try {
    const { getRelationships } = require("../graph/knowledgeGraphService");
    return res.json(
      await getRelationships(req.params.id, {
        type: req.query.type,
        minimumConfidence: req.query.minimumConfidence,
        limit: req.query.limit,
        offset: req.query.offset,
      }),
    );
  } catch (error) {
    return sendError(res, error, "Universal document relationships failed");
  }
});

router.get("/:id/recommendations", async (req, res) => {
  try {
    const [recommendations, relatedChats] = await Promise.all([
      getDocumentRecommendations(req.params.id, req.user.id, {
        type: req.query.type,
        limit: req.query.limit,
        includeNonReady: req.query.includeNonReady,
        useUserProfile: req.query.useUserProfile,
        query: req.query.q || req.query.query,
      }),
      DocumentService.getRelatedChats(
        req.params.id,
        req.user.id,
        req.query.limit,
      ),
    ]);
    return res.json({
      documentId: String(req.params.id),
      recommendations,
      relatedChats,
    });
  } catch (error) {
    return sendError(res, error, "Universal recommendations failed");
  }
});

router.get("/:id/timeline", async (req, res) => {
  try {
    const timeline = await DocumentService.getTimeline(req.params.id);
    return res.json({ timeline });
  } catch (error) {
    return sendError(res, error, "Universal timeline failed");
  }
});

router.get("/:id/graph", async (req, res) => {
  try {
    const { getGraph } = require("../graph/knowledgeGraphService");
    const graph = await getGraph(req.params.id, {
      depth: req.query.depth,
      limit: req.query.limit,
    });
    return res.json({ graph });
  } catch (error) {
    return sendError(res, error, "Universal graph failed");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [document, readiness] = await Promise.all([
      DocumentService.getById(req.params.id, req.user.id),
      getDocumentReadiness(req.params.id),
    ]);
    if (!document || !readiness) {
      return res.status(404).json({ error: "Document not found." });
    }
    let backgroundPreparation = null;
    if (readiness.canPrepare && !readiness.comparisonReady) {
      try {
        const job = await enqueueProcessing(req.params.id, req.user.id, {
          priority: 90,
          reason: "auto_open_document_detail",
        });
        backgroundPreparation = {
          queued: true,
          jobId: job?.id || null,
          status: job?.status || "queued",
        };
      } catch (enqueueError) {
        console.warn(
          "Automatic document detail preparation enqueue failed:",
          sanitizeProviderError(enqueueError),
        );
        backgroundPreparation = {
          queued: false,
          error: "Document preparation could not be queued automatically.",
        };
      }
    }
    const {
      sources = [],
      resources = [],
      relationships = [],
      recommendations = [],
      warnings = [],
      ...documentPayload
    } = document;
    const { document: _readinessDocument, ...readinessPayload } = readiness;
    return res.json({
      document: {
        ...documentPayload,
        sources,
        resources,
        relationships,
        recommendations,
        readiness: readinessPayload,
        backgroundPreparation,
        warnings,
      },
      sources,
      resources,
      relationships,
      recommendations,
      readiness: readinessPayload,
      backgroundPreparation,
      warnings,
    });
  } catch (error) {
    return sendError(res, error, "Universal document lookup failed");
  }
});

module.exports = router;
