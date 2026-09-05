const express = require("express");
const crypto = require("node:crypto");
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
  validateAnswerCompleteness,
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
const {
  ANSWER_INTENTS,
  classifyAnswerIntent,
  classifyFreshness,
  enforceFreshnessGuard,
  requiresCurrentVerification,
} = require("../retrieval/adaptiveIntelligenceService");
const {
  assessCurrentVerification,
  loadDocumentSourceFreshness,
} = require("./temporalLegalService");

const router = express.Router();

const CHAT_REQUEST_LIMITS = Object.freeze({
  questionChars: 20_000,
  displayMessageChars: 20_000,
  workflowIdChars: 80,
  workflowTitleChars: 120,
  workflowGroupChars: 80,
  responseLanguageChars: 40,
  sourceIds: 20,
  sourceIdChars: 120,
});

const chatRequestError = (status, failureCode, message) => {
  const error = new Error(message);
  error.status = status;
  error.failureCode = failureCode;
  return error;
};

const validateGeneratedChatPayload = (body = {}) => {
  if (typeof body.message !== "string") {
    throw chatRequestError(
      422,
      "INVALID_CHAT_PAYLOAD",
      "Message must be text.",
    );
  }
  const message = body.message.trim();
  if (!message) {
    throw chatRequestError(400, "MESSAGE_REQUIRED", "Message is required.");
  }
  if (message.length > CHAT_REQUEST_LIMITS.questionChars) {
    throw chatRequestError(
      413,
      "CHAT_MESSAGE_TOO_LARGE",
      `Questions are limited to ${CHAT_REQUEST_LIMITS.questionChars.toLocaleString("en-US")} characters.`,
    );
  }

  if (
    body.displayMessage !== undefined &&
    typeof body.displayMessage !== "string"
  ) {
    throw chatRequestError(
      422,
      "INVALID_CHAT_PAYLOAD",
      "Display message must be text.",
    );
  }
  const displayMessage = String(body.displayMessage || message).trim() || message;
  if (displayMessage.length > CHAT_REQUEST_LIMITS.displayMessageChars) {
    throw chatRequestError(
      413,
      "CHAT_DISPLAY_MESSAGE_TOO_LARGE",
      `Displayed questions are limited to ${CHAT_REQUEST_LIMITS.displayMessageChars.toLocaleString("en-US")} characters.`,
    );
  }

  let workflow = null;
  if (body.workflow !== undefined && body.workflow !== null) {
    if (
      typeof body.workflow !== "object" ||
      Array.isArray(body.workflow)
    ) {
      throw chatRequestError(
        422,
        "INVALID_CHAT_WORKFLOW",
        "Workflow must be a structured object.",
      );
    }
    const fields = [
      ["id", CHAT_REQUEST_LIMITS.workflowIdChars],
      ["title", CHAT_REQUEST_LIMITS.workflowTitleChars],
      ["group", CHAT_REQUEST_LIMITS.workflowGroupChars],
    ];
    for (const [field, maximum] of fields) {
      if (
        body.workflow[field] !== undefined &&
        typeof body.workflow[field] !== "string"
      ) {
        throw chatRequestError(
          422,
          "INVALID_CHAT_WORKFLOW",
          `Workflow ${field} must be text.`,
        );
      }
      if (String(body.workflow[field] || "").length > maximum) {
        throw chatRequestError(
          413,
          "CHAT_WORKFLOW_TOO_LARGE",
          `Workflow ${field} exceeds the supported limit.`,
        );
      }
    }
    workflow = {
      id: String(body.workflow.id || ""),
      title: String(body.workflow.title || ""),
      group: String(body.workflow.group || ""),
    };
  }

  if (body.sourceIds !== undefined && !Array.isArray(body.sourceIds)) {
    throw chatRequestError(
      422,
      "INVALID_CHAT_SOURCES",
      "Selected source IDs must be an array.",
    );
  }
  const sourceIds = body.sourceIds || [];
  if (sourceIds.length > CHAT_REQUEST_LIMITS.sourceIds) {
    throw chatRequestError(
      413,
      "CHAT_SOURCES_TOO_LARGE",
      `A chat turn can use at most ${CHAT_REQUEST_LIMITS.sourceIds} selected sources.`,
    );
  }
  const normalizedSourceIds = sourceIds.map((sourceId) => {
    if (!(["string", "number"].includes(typeof sourceId))) {
      throw chatRequestError(
        422,
        "INVALID_CHAT_SOURCES",
        "Every selected source must have a valid ID.",
      );
    }
    const normalized = String(sourceId).trim();
    if (!normalized) {
      throw chatRequestError(
        422,
        "INVALID_CHAT_SOURCES",
        "Every selected source must have a valid ID.",
      );
    }
    if (normalized.length > CHAT_REQUEST_LIMITS.sourceIdChars) {
      throw chatRequestError(
        413,
        "CHAT_SOURCES_TOO_LARGE",
        "A selected source ID exceeds the supported limit.",
      );
    }
    return normalized;
  });

  if (
    body.responseLanguage !== undefined &&
    typeof body.responseLanguage !== "string"
  ) {
    throw chatRequestError(
      422,
      "INVALID_CHAT_PAYLOAD",
      "Response language must be text.",
    );
  }
  const responseLanguage = String(body.responseLanguage || "Auto").trim() || "Auto";
  if (responseLanguage.length > CHAT_REQUEST_LIMITS.responseLanguageChars) {
    throw chatRequestError(
      413,
      "CHAT_RESPONSE_LANGUAGE_TOO_LARGE",
      "Response language exceeds the supported limit.",
    );
  }

  let conversationEpoch = null;
  if (body.conversationEpoch !== undefined && body.conversationEpoch !== null) {
    const candidate = Number(body.conversationEpoch);
    if (!Number.isSafeInteger(candidate) || candidate < 0) {
      throw chatRequestError(
        422,
        "INVALID_CHAT_CONVERSATION_EPOCH",
        "Conversation version is invalid.",
      );
    }
    conversationEpoch = candidate;
  }

  return {
    conversationEpoch,
    displayMessage,
    message,
    responseLanguage,
    sourceIds: [...new Set(normalizedSourceIds)],
    workflow,
  };
};

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

const sendGeneratedChatError = (res, error) => {
  if (!res.headersSent) {
    return sendError(res, error, "Unified document chat failed");
  }
  errorSSE(res, error);
  return undefined;
};

const conversationContext = (chat, currentMessage) => (chat?.messages || [])
  .filter((item) => String(item?.text || "").trim() &&
    String(item.text).trim() !== String(currentMessage || "").trim())
  .slice(-6)
  .map((item) => `${item.sender === "assistant" ? "Assistant" : "User"}: ${compactText(item.text, 600)}`)
  .join("\n");

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

const addMessageWithSessionRecovery = async ({
  userId,
  documentType,
  documentId,
  message,
  documentChat = DocumentChat,
  loadDocument = getDocumentContext,
}) => {
  const existingChat = await documentChat.addMessage(
    userId,
    documentType,
    documentId,
    message,
  );
  if (existingChat) return existingChat;

  // Source-only workspaces can become chat-enabled after a researcher adds
  // an external source. Those workspaces intentionally skip session creation
  // during initial page load, so recover atomically at the first saved message.
  const document = await loadDocument(documentType, documentId);
  if (!document) return null;
  await documentChat.findOrCreate(userId, {
    ...document,
    documentType,
    documentId,
    summary: null,
  });
  return documentChat.addMessage(
    userId,
    documentType,
    documentId,
    message,
  );
};

const chatPersistenceError = (publicMessage) => {
  const error = new Error(publicMessage);
  error.status = 500;
  error.publicMessage = publicMessage;
  error.failureCode = "CHAT_PERSISTENCE_FAILED";
  error.publicCode = "CHAT_PERSISTENCE_FAILED";
  return error;
};

const normalizeTurnRequestId = (value) => {
  const requestId = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._:-]/g, "-")
    .slice(0, 80);
  return requestId || crypto.randomUUID();
};

const generationInProgressError = () => {
  const error = new Error(
    "This answer is already being generated. Please retry shortly.",
  );
  error.status = 409;
  error.failureCode = "CHAT_GENERATION_IN_PROGRESS";
  error.publicCode = "CHAT_GENERATION_IN_PROGRESS";
  return error;
};

const waitForGenerationResult = async ({
  userId,
  documentType,
  documentId,
  requestId,
  documentChat = DocumentChat,
  timeoutMs = 30_000,
  pollIntervalMs = 75,
  wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
}) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const generation = await documentChat.getGeneration(
      userId,
      documentType,
      documentId,
      requestId,
    );
    if (generation?.status === "completed" && generation.response_json) {
      return generation.response_json;
    }
    if (!generation || generation.status === "failed") return null;
    await wait(pollIntervalMs);
  }
  throw generationInProgressError();
};

const beginGeneratedChatTurn = async ({
  userId,
  documentType,
  documentId,
  document,
  message,
  displayMessage,
  requestId,
  responseLanguage,
  sourceIds = [],
  workflow = null,
  conversationEpoch = null,
  documentChat = DocumentChat,
}) => {
  const turnId = normalizeTurnRequestId(requestId);
  const session = await documentChat.findOrCreate(userId, {
    ...document,
    documentType,
    documentId,
    summary: document?.summary || null,
  });
  if (!session) {
    throw chatPersistenceError(
      "The research conversation could not be created. Please retry.",
    );
  }
  const activeConversationEpoch = Number(session.conversationEpoch || 0);
  if (
    conversationEpoch !== null &&
    Number(conversationEpoch) !== activeConversationEpoch
  ) {
    throw chatRequestError(
      409,
      "CHAT_CONVERSATION_CLEARED",
      "This conversation was cleared. Please submit the question again.",
    );
  }
  const claim = typeof documentChat.claimGeneration === "function"
    ? await documentChat.claimGeneration(
      userId,
      documentType,
      documentId,
      turnId,
      activeConversationEpoch,
    )
    : { claimAcquired: true, owner_token: crypto.randomUUID() };
  if (!claim?.claimAcquired) {
    const reusedResponse = claim?.status === "completed" && claim.response_json
      ? claim.response_json
      : await waitForGenerationResult({
        userId,
        documentType,
        documentId,
        requestId: turnId,
        documentChat,
      });
    if (reusedResponse) {
      return {
        chat: session,
        turnId,
        userMessageId: `${turnId}:user`,
        assistantMessageId: turnId,
        claimAcquired: false,
        reusedResponse,
      };
    }
    throw generationInProgressError();
  }
  const userMessageId = `${turnId}:user`;
  // Keep the assistant ID identical to the optimistic stream ID so feedback,
  // export, and post-refresh message actions all address the same message.
  const assistantMessageId = turnId;
  const chat = await documentChat.addMessage(
    userId,
    documentType,
    documentId,
    {
      id: userMessageId,
      text: String(displayMessage || message),
      sender: "user",
      timestamp: new Date().toISOString(),
      metadata: {
        requestId: turnId,
        responseLanguage: responseLanguage || "Auto",
        sourceIds: sourceIds.map(String),
        ...(workflow
          ? {
              workflowId: workflow.id,
              workflowTitle: workflow.title,
              workflowGroup: workflow.group,
              executionPrompt: message,
            }
          : {}),
      },
      conversationEpoch: activeConversationEpoch,
    },
  );
  if (!chat) {
    if (typeof documentChat.failGeneration === "function") {
      await documentChat.failGeneration(
        userId,
        documentType,
        documentId,
        turnId,
        claim.owner_token,
      ).catch(() => undefined);
    }
    const current = typeof documentChat.findOne === "function"
      ? await documentChat.findOne(userId, documentType, documentId)
        .catch(() => null)
      : null;
    if (current && Number(current.conversationEpoch || 0) !== activeConversationEpoch) {
      throw chatRequestError(
        409,
        "CHAT_CONVERSATION_CLEARED",
        "This conversation was cleared. Please submit the question again.",
      );
    }
    throw chatPersistenceError(
      "The research question could not be saved. Please retry.",
    );
  }
  return {
    chat,
    turnId,
    userMessageId,
    assistantMessageId,
    claimAcquired: true,
    ownerToken: claim.owner_token,
    conversationEpoch: activeConversationEpoch,
  };
};

const persistGeneratedChatResponse = async ({
  lifecycle,
  userId,
  documentType,
  documentId,
  text,
  sources = [],
  metadata = {},
  documentChat = DocumentChat,
}) => {
  const storedMetadata = {
    ...metadata,
    requestId: lifecycle.turnId,
    ...(metadata.workflow
      ? {
          workflowId: metadata.workflow.id,
          workflowTitle: metadata.workflow.title,
          workflowGroup: metadata.workflow.group,
        }
      : {}),
  };
  const assistantMessage = {
    id: lifecycle.assistantMessageId,
    text,
    sender: "assistant",
    timestamp: new Date().toISOString(),
    sources,
    metadata: storedMetadata,
  };
  if (typeof documentChat.completeGeneratedResponse === "function") {
    const completed = await documentChat.completeGeneratedResponse({
      userId,
      documentType,
      documentId,
      requestId: lifecycle.turnId,
      ownerToken: lifecycle.ownerToken,
      conversationEpoch: lifecycle.conversationEpoch,
      messageData: assistantMessage,
    });
    if (!completed?.persistence) {
      throw chatPersistenceError(
        "The answer was generated, but it could not be saved. Please retry before leaving this page.",
      );
    }
    lifecycle.completed = true;
    return completed.persistence;
  }
  const chat = await documentChat.addMessage(
    userId,
    documentType,
    documentId,
    assistantMessage,
  );
  if (!chat) {
    throw chatPersistenceError(
      "The answer was generated, but it could not be saved. Please retry before leaving this page.",
    );
  }
  const persistence = {
    saved: true,
    chatId: chat.id,
    conversationId: chat.id,
    turnId: lifecycle.turnId,
    userMessageId: lifecycle.userMessageId,
    assistantMessageId: lifecycle.assistantMessageId,
  };
  if (typeof documentChat.completeGeneration === "function") {
    const completed = await documentChat.completeGeneration(
      userId,
      documentType,
      documentId,
      lifecycle.turnId,
      lifecycle.ownerToken,
      { text, sources, metadata: storedMetadata, persistence },
    );
    if (!completed) {
      throw chatPersistenceError(
        "The answer was saved, but its request state could not be finalized. Please retry.",
      );
    }
  }
  lifecycle.completed = true;
  return persistence;
};

const sendReusedGeneratedChatResponse = (res, lifecycle) => {
  const response = lifecycle.reusedResponse;
  startSSE(res);
  sendSSE(res, {
    type: "meta",
    sources: response.sources || [],
    metadata: {
      ...(response.metadata || {}),
      persistence: response.persistence,
      replayed: true,
    },
  });
  for (const content of responseChunks(String(response.text || ""))) {
    sendSSE(res, { type: "content", content });
  }
  completeSSE(res, {
    metadata: { persistence: response.persistence, replayed: true },
  });
};

router.post("/message", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    if (!req.body.text || !["user", "assistant"].includes(req.body.sender)) {
      return res.status(400).json({
        error: "Message text and a valid sender are required.",
      });
    }
    const chat = await addMessageWithSessionRecovery({
      userId: req.user.id,
      documentType,
      documentId,
      message: req.body,
    });
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
  let lifecycle = null;
  try {
    const { documentType, documentId } = identity(req);
    const {
      displayMessage,
      message,
      responseLanguage,
      sourceIds,
      workflow,
      conversationEpoch,
    } = validateGeneratedChatPayload(req.body);
    const document = await DocumentRepository.getById(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found." });
    }
    lifecycle = await beginGeneratedChatTurn({
      userId: req.user.id,
      documentType,
      documentId,
      document,
      message,
      displayMessage,
      requestId: req.body.requestId,
      responseLanguage,
      sourceIds,
      workflow,
      conversationEpoch,
    });
    if (lifecycle.reusedResponse) {
      sendReusedGeneratedChatResponse(res, lifecycle);
      return undefined;
    }
    if (isPdfExportRequest(message)) {
      const chat = lifecycle.chat;
      const report = [...(chat?.messages || [])]
        .reverse()
        .find(isExportableReportMessage);
      if (!report) {
        const answer = "Create a research answer or brief first, then ask me to export it as a PDF.";
        const persistence = await persistGeneratedChatResponse({
          lifecycle,
          userId: req.user.id,
          documentType,
          documentId,
          text: answer,
          metadata: { exportReady: false, exportFormat: "pdf" },
        });
        startSSE(res);
        sendSSE(res, {
          type: "content",
          content: answer,
        });
        sendSSE(res, { type: "meta", metadata: { persistence } });
        completeSSE(res, { metadata: { persistence } });
        return undefined;
      }
      const answer = "Your cited PDF brief is ready. Select **Download PDF** below.";
      const persistence = await persistGeneratedChatResponse({
        lifecycle,
        userId: req.user.id,
        documentType,
        documentId,
        text: answer,
        sources: report.sources || [],
        metadata: {
          grounded: true,
          exportReady: true,
          exportFormat: "pdf",
          exportMessageId: String(report._id || report.id),
        },
      });
      startSSE(res);
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
          persistence,
        },
      });
      sendSSE(res, {
        type: "content",
        content: answer,
      });
      completeSSE(res, { metadata: { persistence } });
      return undefined;
    }
    const answerIntent = classifyAnswerIntent(message);
    const freshnessClass = classifyFreshness(message, answerIntent);
    const freshnessRequired = requiresCurrentVerification(freshnessClass);
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
    const [retrieval, relationshipContext, textArtifact, sourceFreshness] = await Promise.all([
      retrieveDocumentContext(documentType, documentId, message, {
        topK: settings.finalPassages,
        plan,
        document,
        flags,
        accountId: req.user.id,
        freshnessRequired,
      }),
      relationshipPromise,
      getTextArtifact(documentId),
      freshnessRequired
        ? loadDocumentSourceFreshness(document).catch(() => ({ status: "error" }))
        : Promise.resolve({ status: "not_required", checkedThrough: null }),
    ]);
    const currentVerification = freshnessRequired
      ? assessCurrentVerification({ document, passages: retrieval.passages, freshness: sourceFreshness })
      : { required: false, status: "NOT_REQUIRED", checkedAt: new Date().toISOString() };
    const passages = selectContextPassages(retrieval.passages, {
      tokenBudget: settings.contextTokenBudget,
      perPassageChars: plan.queryType === "EXACT_REFERENCE" ? 2_400 : 1_600,
    });
    const userSourceContext = await getSourceContext(
      req.user.id,
      sourceIds,
      message,
      {
        purpose: freshnessRequired
          ? "current_status"
          : answerIntent === "COMPLIANCE"
            ? "compliance"
            : answerIntent === "LEGAL_EFFECT"
              ? "legal"
              : "research",
      },
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
        const dates = [
          item.publicationDate ? `Published ${String(item.publicationDate).slice(0, 10)}` : null,
          item.effectiveDate ? `Effective ${String(item.effectiveDate).slice(0, 10)}` : null,
          item.commencementDate ? `Commenced ${String(item.commencementDate).slice(0, 10)}` : null,
          item.indexedAt ? `Indexed ${String(item.indexedAt).slice(0, 10)}` : null,
          item.authorityClass ? `Authority class ${item.authorityClass}` : null,
        ].filter(Boolean).join(" | ");
        return `[Source ${item.passage}: ${location}${dates ? ` | ${dates}` : ""}]\n${compactText(item.content, 1_600)}`;
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

    let responsePersistence = null;
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
        sourceLimitations: userSourceContext.limitations || [],
        evidenceSufficiency: sufficiency,
        retrieval: {
          ...retrieval.diagnostics,
          timings: {
            ...retrieval.diagnostics.timings,
            graphMs: graphLatencyMs,
          },
        },
        workflow,
        answerIntent,
        freshnessClass,
        currentVerification,
      },
    });
    if (!context.trim()) {
      const answer =
        "I could not find enough grounded context in this document to answer reliably.";
      responsePersistence = await persistGeneratedChatResponse({
        lifecycle,
        userId: req.user.id,
        documentType,
        documentId,
        text: answer,
        sources,
        metadata: {
          grounded: true,
          abstained: true,
          generationMode: "no_grounded_context",
          evidenceSufficiency: sufficiency,
          answerIntent,
          freshnessClass,
          currentVerification,
        },
      });
      await emitTelemetry({ output: answer, abstained: true });
      sendSSE(res, {
        type: "content",
        content: answer,
      });
      sendSSE(res, {
        type: "meta",
        metadata: { persistence: responsePersistence },
      });
      completeSSE(res, { metadata: { persistence: responsePersistence } });
      return undefined;
    }
    const explainConflict = [ANSWER_INTENTS.CURRENT_STATUS, ANSWER_INTENTS.TIMELINE]
      .includes(answerIntent);
    const stableGeneralContext = answerIntent === ANSWER_INTENTS.GENERAL_CONTEXT;
    if (!stableGeneralContext && ([
      SUFFICIENCY_LEVELS.INSUFFICIENT,
      ...(explainConflict ? [] : [SUFFICIENCY_LEVELS.CONFLICTING]),
    ].includes(sufficiency.level))) {
      const abstention = buildAbstentionResponse(sufficiency, {
        documentTitles: [document?.title].filter(Boolean),
      });
      responsePersistence = await persistGeneratedChatResponse({
        lifecycle,
        userId: req.user.id,
        documentType,
        documentId,
        text: abstention,
        sources,
        metadata: {
          grounded: true,
          abstained: true,
          generationMode: "evidence_abstention",
          evidenceSufficiency: sufficiency,
          answerIntent,
          freshnessClass,
          currentVerification,
        },
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
          persistence: responsePersistence,
        },
      });
      await emitTelemetry({ output: abstention, abstained: true });
      completeSSE(res, { metadata: { persistence: responsePersistence } });
      return undefined;
    }
    try {
      const generationStartedAt = Date.now();
      const stream = await generateResponse(message, context, {
        responseLanguage,
        task: "document_chat",
        intent: answerIntent,
        freshnessClass,
        currentVerification,
        conversationHistory: conversationContext(lifecycle.chat, message),
        strictCompliance: answerIntent === ANSWER_INTENTS.COMPLIANCE,
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
            allowStableGeneralKnowledge: stableGeneralContext,
          })
        : {
            answer: generatedAnswer, claims: [], unsupportedBeforeRepair: 0,
            unsupportedAfterRepair: 0, supportedFacts: 0, repairAttempts: 0,
            abstained: false, version: "legacy-unverified-v1",
          };
      const verificationLatency = Date.now() - verificationStartedAt;
      verification.answer = enforceFreshnessGuard(verification.answer, currentVerification);
      const completeness = validateAnswerCompleteness(verification.answer);
      if (!completeness.complete) {
        // One bounded safety action: replace a dangling provider response with
        // the already-retrieved evidence. Never persist visibly incomplete text
        // as a successful answer and never loop repairs.
        verification.answer = buildGroundedExtractiveAnswer(message, evidence);
        verification.abstained = true;
        verification.completeness = completeness;
      }
      responsePersistence = await persistGeneratedChatResponse({
        lifecycle,
        userId: req.user.id,
        documentType,
        documentId,
        text: verification.answer,
        sources,
        metadata: {
          grounded: true,
          generationMode: verification.abstained ? "verification_abstention" : "ai_verified",
          verification: summarizeVerification(verification),
          completeness: verification.completeness || { complete: true },
          evidenceSufficiency: sufficiency,
          retrieval: retrieval.diagnostics,
          workflow,
          answerIntent,
          freshnessClass,
          currentVerification,
        },
      });
      for (const content of responseChunks(verification.answer)) {
        if (res.destroyed || res.writableEnded) break;
        sendSSE(res, { type: "content", content });
      }
      sendSSE(res, {
        type: "meta",
        metadata: {
          generationMode: verification.abstained ? "verification_abstention" : "ai_verified",
          verification: summarizeVerification(verification),
          completeness: verification.completeness || { complete: true },
          evidenceSufficiency: sufficiency,
          answerIntent,
          freshnessClass,
          currentVerification,
          persistence: responsePersistence,
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
      responsePersistence = await persistGeneratedChatResponse({
        lifecycle,
        userId: req.user.id,
        documentType,
        documentId,
        text: fallback,
        sources,
        metadata: {
          grounded: true,
          generationMode: "extractive_fallback",
          evidenceSufficiency: sufficiency,
          workflow,
          answerIntent,
          freshnessClass,
          currentVerification,
        },
      });
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
          persistence: responsePersistence,
        },
      });
    }
    if (!res.destroyed && !res.writableEnded) {
      completeSSE(res, { metadata: { persistence: responsePersistence } });
    }
    return undefined;
  } catch (error) {
    if (
      lifecycle?.claimAcquired &&
      !lifecycle.completed &&
      typeof DocumentChat.failGeneration === "function"
    ) {
      await DocumentChat.failGeneration(
        req.user.id,
        lifecycle.chat.documentType,
        lifecycle.chat.documentId,
        lifecycle.turnId,
        lifecycle.ownerToken,
      ).catch(() => undefined);
    }
    return sendGeneratedChatError(res, error);
  }
});

module.exports = router;
module.exports.CHAT_REQUEST_LIMITS = CHAT_REQUEST_LIMITS;
module.exports.beginGeneratedChatTurn = beginGeneratedChatTurn;
module.exports.persistGeneratedChatResponse = persistGeneratedChatResponse;
module.exports.resolveDocumentIdentity = identity;
module.exports.addMessageWithSessionRecovery = addMessageWithSessionRecovery;
module.exports.sendGeneratedChatError = sendGeneratedChatError;
module.exports.sendReusedGeneratedChatResponse = sendReusedGeneratedChatResponse;
module.exports.validateGeneratedChatPayload = validateGeneratedChatPayload;
module.exports.waitForGenerationResult = waitForGenerationResult;
