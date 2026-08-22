const express = require("express");
const { generationLimiter } = require("../middleware/security");
const DocumentChat = require("../models/DocumentChat");
const {
  getDocumentContext,
  getTextArtifact,
  retrieveDocumentContext,
  ensureSummary,
} = require("./documentResearchService");
const { generateResponse, providerConfig } = require("../lib/vectordb");
const { sanitizeProviderError } = require("../lib/providerErrorSanitizer");
const { sendError } = require("../lib/httpResponse");
const {
  getRelationshipContext,
} = require("../graph/knowledgeGraphService");
const {
  enqueueProcessing,
  prepareDocument,
} = require("./readinessService");
const { getDocumentReadiness } = require("./readinessContract");
const DocumentRepository = require("./DocumentRepository");
const { getSourceContext } = require("../research/sourceService");
const { planQuery } = require("../retrieval/queryPlanner");
const { retrievalConfig } = require("../retrieval/retrievalConfig");
const { applyResearchFlags, resolveResearchFlags } = require("../retrieval/featureFlags");
const { recordResearchTelemetry } = require("../retrieval/researchTelemetry");
const { selectContextPassages } = require("../retrieval/contextBuilder");
const {
  SUFFICIENCY_LEVELS,
  assessEvidenceSufficiency,
  buildAbstentionResponse,
  buildGroundedExtractiveAnswer,
  summarizeVerification,
  verifyAndRepairAnswer,
} = require("../retrieval/evidenceSafetyService");
const {
  completeSSE,
  errorSSE,
  sendSSE,
  startSSE,
} = require("../lib/sse");
const {
  createResearchBriefPdf,
  isExportableReportMessage,
  isPdfExportRequest,
  safeFilePart,
} = require("./reportPdfService");

const router = express.Router();

const compactText = (value, maxLength = 1_200) =>
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

const buildBriefContext = (document, textArtifact) => {
  const sections = textArtifact?.summarySections || {};
  const lines = [
    textArtifact?.englishSummary
      ? `[Document brief: ${document?.title || "Selected document"}]\n${compactText(textArtifact.englishSummary, 2_400)}`
      : "",
    sections.executive_summary
      ? `[Brief section: Executive Summary]\n${compactText(sections.executive_summary, 900)}`
      : "",
    sections.implementation
      ? `[Brief section: Implementation]\n${compactText(sections.implementation, 900)}`
      : "",
    sections.affected_authorities
      ? `[Brief section: Affected Authorities]\n${compactText(sections.affected_authorities, 700)}`
      : "",
    sections.legal_impact
      ? `[Brief section: Legal Impact]\n${compactText(sections.legal_impact, 700)}`
      : "",
  ].filter(Boolean);
  return lines.join("\n\n");
};

const buildExtractiveChatFallback = (message, passages, relationshipSources = []) => {
  const sourceLines = passages
    .slice(0, 4)
    .map((passage, index) => {
      const snippet = String(passage.content || "")
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 520);
      return `- Source ${index + 1}: ${snippet}`;
    })
    .filter((line) => line.length > 12);
  const relationshipLine = relationshipSources.length
    ? `\n\nKnowledge graph context was also available from ${relationshipSources.length} relationship source(s).`
    : "";
  return [
    "AI generation is temporarily unavailable, so Rashtram AI is answering from retrieved source passages only.",
    "",
    `Question: ${message}`,
    "",
    "Grounded extractive answer:",
    sourceLines.length
      ? sourceLines.join("\n")
      : "- No suitable passage excerpt was available.",
    relationshipLine,
  ].join("\n");
};

const identity = (req) => {
  const body = req.body || {};
  const requestQuery = req.query || {};
  const params = req.params || {};
  const rawId =
    body.documentId || requestQuery.documentId || params.documentId;
  if (!rawId) {
    const error = new Error("Document ID is required.");
    error.status = 400;
    throw error;
  }
  let documentType;
  try {
    documentType = DocumentChat.normalizeType(
      body.documentType ||
        requestQuery.documentType ||
        params.documentType,
    );
  } catch (error) {
    error.status = 400;
    throw error;
  }
  return {
    documentType,
    documentId: String(rawId),
  };
};

router.get("/document/:documentType/:documentId", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const [document, readiness] = await Promise.all([
      getDocumentContext(documentType, documentId),
      getDocumentReadiness(documentId),
    ]);
    if (!document) {
      return res.status(404).json({ error: "Document not found." });
    }
    // Lazy-load the summary on first access.
    if (document.researchReady && !document.summary) {
      try {
        const result = await ensureSummary(documentType, documentId);
        if (result.summary) {
          document.summary = result.summary;
          if (document.textArtifact) {
            document.textArtifact.englishSummary = result.summary;
            document.textArtifact.summarySections = result.summarySections;
          }
        }
      } catch (summaryError) {
        console.warn(
          "[lazy-summary] Could not generate summary on access:",
          summaryError.message,
        );
      }
    }
    let backgroundPreparation = null;
    if (readiness?.canPrepare && !readiness?.comparisonReady) {
      try {
        const job = await enqueueProcessing(documentId, req.user.id, {
          priority: 90,
          reason: "auto_open_document",
        });
        backgroundPreparation = {
          queued: true,
          jobId: job?.id || null,
          status: job?.status || "queued",
        };
      } catch (enqueueError) {
        console.warn(
          "Automatic document preparation enqueue failed:",
          sanitizeProviderError(enqueueError),
        );
        backgroundPreparation = {
          queued: false,
          error: "Document preparation could not be queued automatically.",
        };
      }
    }
    const { document: _readinessDocument, ...readinessPayload } = readiness || {};
    return res.json({
      document,
      readiness: readinessPayload,
      backgroundPreparation,
    });
  } catch (error) {
    return sendError(res, error, "Unified document context failed");
  }
});

router.post("/process", generationLimiter, async (req, res) => {
  const startedAt = Date.now();
  let documentId = null;
  try {
    const identityValue = identity(req);
    const { documentType } = identityValue;
    documentId = identityValue.documentId;
    console.log("[document-process] started", {
      documentType,
      documentId,
    });
    const result = await prepareDocument(documentId, {
      userId: req.user.id,
      priority: 100,
      reason: "user_prepare",
    });
    console.log("[document-process] completed", {
      documentType,
      documentId,
      chunksStored: result.chunksStored,
      alreadyProcessed: result.alreadyProcessed,
      durationMs: Date.now() - startedAt,
      languageCode: result.textArtifact?.languageCode || null,
      ocrUsed: result.textArtifact?.ocrUsed || false,
    });
    const readiness = await getDocumentReadiness(documentId);
    const { document: _document, ...readinessPayload } = readiness || {};
    return res.json({
      success: Boolean(readiness?.comparisonReady || result.researchReady),
      ...result,
      readiness: readinessPayload,
      researchReady: Boolean(readiness?.researchReady || result.researchReady),
      comparisonReady: Boolean(
        readiness?.comparisonReady || result.comparisonReady,
      ),
    });
  } catch (error) {
    console.error("[document-process] failed", {
      message: error.message,
      status: error.status || 500,
      durationMs: Date.now() - startedAt,
      documentType: req.body?.documentType,
      documentId: req.body?.documentId,
    });
    return sendError(
      res,
      error,
      "Unified document processing failed",
    );
  }
});

router.post("/session", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const document = await getDocumentContext(documentType, documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found." });
    }
    const chat = await DocumentChat.findOrCreate(req.user.id, {
      ...document,
      documentType,
      documentId,
      summary: req.body.summary || null,
    });
    return res.json({ success: true, chat, document });
  } catch (error) {
    return sendError(res, error, "Unified chat session failed");
  }
});

router.get("/history", async (req, res) => {
  try {
    if (!req.query.documentType || !req.query.documentId) {
      const chats = await DocumentChat.getRecent(req.user.id, req.query.limit);
      return res.json({ success: true, chats, count: chats.length });
    }
    const { documentType, documentId } = identity(req);
    const chat = await DocumentChat.findOne(
      req.user.id,
      documentType,
      documentId,
    );
    const notes = await DocumentChat.getNotes(
      req.user.id,
      documentType,
      documentId,
    );
    return res.json({ success: true, chat, notes });
  } catch (error) {
    return sendError(res, error, "Unified chat history failed");
  }
});

router.post("/message", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    if (!req.body.text || !["user", "assistant"].includes(req.body.sender)) {
      return res.status(400).json({
        error: "Message text and a valid sender are required.",
      });
    }
    const chat = await DocumentChat.addMessage(
      req.user.id,
      documentType,
      documentId,
      req.body,
    );
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    return res.json({ success: true, chat });
  } catch (error) {
    return sendError(res, error, "Unified chat message save failed");
  }
});

router.patch("/summary", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    if (!req.body.summary) {
      return res.status(400).json({ error: "Summary is required." });
    }
    const chat = await DocumentChat.updateSummary(
      req.user.id,
      documentType,
      documentId,
      req.body.summary,
    );
    return res.json({ success: true, summary: chat?.summary || null });
  } catch (error) {
    return sendError(res, error, "Unified chat summary update failed");
  }
});

router.patch("/pin", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const chat = await DocumentChat.setPinned(
      req.user.id,
      documentType,
      documentId,
      req.body.isPinned,
    );
    return res.json({ success: true, chat });
  } catch (error) {
    return sendError(res, error, "Unified chat pin update failed");
  }
});

router.delete("/history", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const chat = await DocumentChat.clear(
      req.user.id,
      documentType,
      documentId,
    );
    return res.json({ success: true, chat });
  } catch (error) {
    return sendError(res, error, "Unified chat clear failed");
  }
});

router.post("/notes", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const body = String(req.body.body || "").trim().slice(0, 10_000);
    if (!body) return res.status(400).json({ error: "Note is required." });
    const note = await DocumentChat.addNote(
      req.user.id,
      documentType,
      documentId,
      body,
    );
    return res.status(201).json({ success: true, note });
  } catch (error) {
    return sendError(res, error, "Unified research note save failed");
  }
});

router.delete("/notes/:noteId", async (req, res) => {
  const removed = await DocumentChat.deleteNote(req.user.id, req.params.noteId);
  return res.status(removed ? 200 : 404).json({ success: removed });
});

router.post("/feedback", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    if (![-1, 1].includes(Number(req.body.rating))) {
      return res.status(400).json({ error: "Rating must be -1 or 1." });
    }
    const feedback = await DocumentChat.saveFeedback(
      req.user.id,
      documentType,
      documentId,
      req.body.messageId,
      Number(req.body.rating),
      String(req.body.reason || "").slice(0, 500) || null,
    );
    return res.json({ success: true, feedback });
  } catch (error) {
    return sendError(res, error, "Unified chat feedback save failed");
  }
});

router.get("/export", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const chat = await DocumentChat.findOne(
      req.user.id,
      documentType,
      documentId,
    );
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    const markdown = [
      `# ${chat.title}`,
      "",
      `Document type: ${chat.documentType}`,
      `Exported: ${new Date().toISOString()}`,
      "",
      ...(chat.summary ? ["## Summary", "", chat.summary, ""] : []),
      "## Conversation",
      "",
      ...chat.messages.flatMap((message) => [
        `### ${message.sender === "user" ? "Researcher" : "Rashtram AI"}`,
        "",
        message.text,
        "",
      ]),
    ].join("\n");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rashtram-${documentType}-${documentId}.md"`,
    );
    return res.send(markdown);
  } catch (error) {
    return sendError(res, error, "Unified chat export failed");
  }
});

router.get("/export/report", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const chat = await DocumentChat.findOne(
      req.user.id,
      documentType,
      documentId,
    );
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    const assistantMessages = chat.messages.filter(
      (message) => message.sender === "assistant" && String(message.text || "").trim(),
    );
    const requestedId = String(req.query.messageId || "").trim();
    const report = requestedId
      ? assistantMessages.find((message) =>
          String(message._id || message.id) === requestedId)
      : assistantMessages.at(-1);
    if (!report) {
      return res.status(404).json({ error: "The requested report was not found." });
    }
    const pdf = await createResearchBriefPdf({
      title: chat.title,
      documentType: chat.documentType,
      reportText: report.text,
      sources: report.sources,
    });
    const filename = `rashtram-${safeFilePart(chat.title)}-brief.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    return res.send(pdf);
  } catch (error) {
    return sendError(res, error, "Research brief PDF export failed");
  }
});

router.post("/", generationLimiter, async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }
    if (isPdfExportRequest(message)) {
      const chat = await DocumentChat.findOne(
        req.user.id,
        documentType,
        documentId,
      );
      const report = [...(chat?.messages || [])]
        .reverse()
        .find(isExportableReportMessage);
      startSSE(res);
      if (!report) {
        sendSSE(res, {
          type: "content",
          content: "Create a research answer or brief first, then ask me to export it as a PDF.",
        });
        completeSSE(res);
        return undefined;
      }
      sendSSE(res, {
        type: "meta",
        documentType,
        documentId,
        sources: report.sources || [],
        metadata: {
          grounded: true,
          exportReady: true,
          exportFormat: "pdf",
          exportMessageId: String(report._id || report.id),
        },
      });
      sendSSE(res, {
        type: "content",
        content: "Your cited PDF brief is ready. Select **Download PDF** below.",
      });
      completeSSE(res);
      return undefined;
    }
    const workflow = req.body.workflow && typeof req.body.workflow === "object"
      ? {
          id: String(req.body.workflow.id || "").slice(0, 80),
          title: String(req.body.workflow.title || "").slice(0, 120),
          group: String(req.body.workflow.group || "").slice(0, 80),
        }
      : null;
    const sourceIds = Array.isArray(req.body.sourceIds)
      ? req.body.sourceIds.slice(0, 20)
      : [];
    const document = await DocumentRepository.getById(documentId);
    const flags = resolveResearchFlags({ actorId: req.user.id });
    const plan = applyResearchFlags(planQuery(message), flags);
    const settings = retrievalConfig();
    let graphLatencyMs = 0;
    const relationshipPromise = plan.useGraph
      ? (async () => {
          const startedAt = Date.now();
          try {
            return await getRelationshipContext(
              documentId,
              message,
              settings.graphCandidates,
            );
          } finally {
            graphLatencyMs = Date.now() - startedAt;
          }
        })()
      : Promise.resolve({ context: "", sources: [], graphGrounded: false });
    const [retrieval, relationshipContext, textArtifact] = await Promise.all([
      retrieveDocumentContext(documentType, documentId, message, {
        topK: settings.finalPassages,
        plan,
        document,
        flags,
        accountId: req.user.id,
      }),
      relationshipPromise,
      getTextArtifact(documentId),
    ]);
    const passages = selectContextPassages(retrieval.passages, {
      tokenBudget: settings.contextTokenBudget,
      perPassageChars: plan.queryType === "EXACT_REFERENCE" ? 2_400 : 1_600,
    });
    const userSourceContext = await getSourceContext(
      req.user.id,
      sourceIds,
      message,
    );
    const briefContext = buildBriefContext(document, textArtifact);
    const passageContext = passages
      .map((item) => {
        const location = [
          document?.title || `Document ${documentId}`,
          item.pageStart
            ? `Page ${item.pageStart}${
              item.pageEnd && item.pageEnd !== item.pageStart
                ? `–${item.pageEnd}`
                : ""
            }${item.pageEstimate ? " (estimated)" : ""}`
            : null,
          item.sectionTitle || (
            item.sectionId ? `Section ${item.sectionId}` : null
          ),
          item.clauseId ? `Clause ${item.clauseId}` : null,
          typeof item.chunkIndex === "number" ? `Chunk ${item.chunkIndex + 1}` : null,
        ].filter(Boolean).join(" | ");
        return `[Source ${item.passage}: ${location}]\n${compactText(item.content, 1_600)}`;
      })
      .join("\n\n");
    const context = [
      briefContext,
      passageContext,
      relationshipContext.context
        ? `Government knowledge graph:\n${relationshipContext.context}`
        : "",
      userSourceContext.context
        ? `Researcher-selected sources:\n${userSourceContext.context}`
        : "",
    ].filter(Boolean).join("\n\n");
    const sources = [
      ...passages.map((item) => ({
        ...item,
        documentTitle: document?.title || null,
        documentType: document?.type || documentType,
        page: item.pageStart,
        section: item.sectionTitle || item.sectionId,
        clause: item.clauseId,
        chunk: typeof item.chunkIndex === "number" ? item.chunkIndex + 1 : null,
        sourceUrl: item.sourceUrl || document?.sourceUrl || null,
        pdfUrl: item.pdfUrl || document?.pdfUrl || null,
        content: item.content.slice(0, 360),
      })),
      ...relationshipContext.sources,
      ...userSourceContext.sources,
    ];
    const evidence = [
      ...passages,
      ...relationshipContext.sources,
      ...(userSourceContext.evidence || userSourceContext.sources),
    ];
    const sufficiency = flags.evidenceSufficiency ? assessEvidenceSufficiency(message, evidence, {
      queryType: plan.queryType,
      retrievalVerified: retrieval.retrievalVerified,
      minimumEvidence: plan.queryType === "EXACT_REFERENCE" ? 1 : 2,
    }) : {
      level: SUFFICIENCY_LEVELS.MEDIUM,
      decision: "SUFFICIENT", signals: {},
      reasons: ["Evidence gate disabled by controlled rollout."],
      missing: [], conflicts: [], version: "legacy-pass-through-v1",
    };
    const emitTelemetry = async ({
      generationLatency = 0, verificationLatency = 0, output = "",
      verification = {}, abstained = false, fallbackUsed = false,
    } = {}) => recordResearchTelemetry({
      userId: req.user.id,
      queryType: plan.queryType,
      queryPlannerVersion: plan.plannerVersion,
      privacyScope: sourceIds.length ? "account_private" : "public",
      metadataLatency: retrieval.diagnostics.timings.metadataMs,
      ftsLatency: retrieval.diagnostics.timings.lexicalMs,
      vectorLatency: retrieval.diagnostics.timings.vectorMs,
      graphLatency: graphLatencyMs,
      fusionLatency: retrieval.diagnostics.timings.fusionMs,
      rerankLatency: retrieval.diagnostics.timings.rerankMs,
      generationLatency,
      verificationLatency,
      lexicalCandidateCount: retrieval.diagnostics.candidateCounts.lexical,
      vectorCandidateCount: retrieval.diagnostics.candidateCounts.vector,
      fusedCandidateCount: retrieval.diagnostics.candidateCounts.fused,
      finalEvidenceCount: evidence.length,
      sourceAuthorityDistribution: retrieval.diagnostics.authorityDistribution,
      topScores: retrieval.diagnostics.topScores,
      evidenceSufficiencyLevel: sufficiency.level,
      citationsGenerated: sources.length,
      citationsVerified: Number(verification.supportedFacts || 0),
      unsupportedClaimsRemoved: Number(verification.unsupportedBeforeRepair || 0) - Number(verification.unsupportedAfterRepair || 0),
      abstained,
      fallbackUsed,
      tokensIn: Math.ceil((message.length + context.length) / 4),
      tokensOut: Math.ceil(String(output).length / 4),
      model: providerConfig().chatModel,
      embeddingModel: providerConfig().embeddingModel,
      retrievalVersion: retrieval.diagnostics.versions.retrievalVersion,
      cacheStatus: retrieval.diagnostics.cache?.status || "bypass",
      flags: {
        ...flags,
        resourceTypes: [...new Set(evidence.map((item) => item.resourceType).filter(Boolean))].slice(0, 5),
        htmlEvidenceCount: evidence.filter((item) => item.resourceType === "html").length,
      },
    });

    startSSE(res);
    sendSSE(res, {
      type: "meta",
      documentType,
      documentId,
      sources,
      metadata: {
        grounded: true,
        passageCount: passages.length,
        graphSourceCount: relationshipContext.sources.length,
        graphGrounded: relationshipContext.graphGrounded,
        selectedSourceCount: userSourceContext.sources.length,
        evidenceSufficiency: sufficiency,
        retrieval: {
          ...retrieval.diagnostics,
          timings: {
            ...retrieval.diagnostics.timings,
            graphMs: graphLatencyMs,
          },
        },
        workflow,
      },
    });
    if (!context.trim()) {
      await emitTelemetry({ abstained: true });
      sendSSE(res, {
        type: "content",
        content:
          "I could not find enough grounded context in this document to answer reliably.",
      });
      completeSSE(res);
      return undefined;
    }
    if ([
      SUFFICIENCY_LEVELS.INSUFFICIENT,
      SUFFICIENCY_LEVELS.CONFLICTING,
    ].includes(sufficiency.level)) {
      const abstention = buildAbstentionResponse(sufficiency, {
        documentTitles: [document?.title].filter(Boolean),
      });
      sendSSE(res, {
        type: "content",
        content: abstention,
      });
      sendSSE(res, {
        type: "meta",
        metadata: {
          abstained: true,
          generationMode: "evidence_abstention",
          evidenceSufficiency: sufficiency,
        },
      });
      await emitTelemetry({ output: abstention, abstained: true });
      completeSSE(res);
      return undefined;
    }
    const responseLanguage = req.body.responseLanguage || "Auto";
    try {
      const generationStartedAt = Date.now();
      const stream = await generateResponse(message, context, {
        responseLanguage,
      });
      let generatedAnswer = "";
      for await (const chunk of stream) {
        if (res.destroyed || res.writableEnded) break;
        const content =
          typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
        if (content) generatedAnswer += content;
      }
      const generationLatency = Date.now() - generationStartedAt;
      const verificationStartedAt = Date.now();
      const verification = flags.citationVerifier
        ? await verifyAndRepairAnswer(generatedAnswer, evidence, {
            sufficiency,
            documentTitles: [document?.title].filter(Boolean),
          })
        : {
            answer: generatedAnswer, claims: [], unsupportedBeforeRepair: 0,
            unsupportedAfterRepair: 0, supportedFacts: 0, repairAttempts: 0,
            abstained: false, version: "legacy-unverified-v1",
          };
      const verificationLatency = Date.now() - verificationStartedAt;
      for (const content of responseChunks(verification.answer)) {
        if (res.destroyed || res.writableEnded) break;
        sendSSE(res, { type: "content", content });
      }
      sendSSE(res, {
        type: "meta",
        metadata: {
          generationMode: verification.abstained ? "verification_abstention" : "ai_verified",
          verification: summarizeVerification(verification),
          evidenceSufficiency: sufficiency,
        },
      });
      await emitTelemetry({
        generationLatency,
        verificationLatency,
        output: verification.answer,
        verification,
        abstained: verification.abstained,
      });
    } catch (generationError) {
      const providerError = sanitizeProviderError(generationError);
      console.warn(
        `Unified document chat generation unavailable; using extractive fallback: ${providerError}`,
      );
      const fallback = buildGroundedExtractiveAnswer(message, evidence);
      sendSSE(res, {
        type: "content",
        content: fallback,
      });
      await emitTelemetry({ output: fallback, fallbackUsed: true });
      sendSSE(res, {
        type: "meta",
        metadata: {
          generationMode: "extractive_fallback",
          providerError,
          evidenceSufficiency: sufficiency,
          verification: {
            mode: "direct_extractive_evidence",
            unsupportedAfterRepair: 0,
            abstained: false,
          },
        },
      });
    }
    if (!res.destroyed && !res.writableEnded) completeSSE(res);
    return undefined;
  } catch (error) {
    console.error("Unified document chat failed:", error);
    if (!res.headersSent) {
      return res.status(error.status || 500).json({ error: error.message });
    }
    errorSSE(res, error);
    return undefined;
  }
});

module.exports = router;
module.exports.resolveDocumentIdentity = identity;
