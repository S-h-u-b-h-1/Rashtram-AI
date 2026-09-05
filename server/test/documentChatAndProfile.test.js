const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ALLOWED_DOCUMENT_TYPES,
  CLAIM_CHAT_GENERATION_SQL,
  CHAT_GENERATION_RETENTION,
  CHAT_STORAGE_LIMITS,
  CLEAR_CHAT_GENERATIONS_SQL,
  CLEANUP_CHAT_GENERATIONS_SQL,
  PRUNE_CHAT_GENERATIONS_SQL,
  UPSERT_CHAT_MESSAGE_SQL,
  clear,
  cleanupGenerationClaims,
  normalizeType,
  validateChatMessageData,
} = require("../models/DocumentChat");
const {
  TYPE_CONFIG,
} = require("../document/documentResearchService");
const {
  DOCUMENT_DATE_EXPRESSION,
  buildFilters,
  mapDocument,
} = require("../document/DocumentRepository");
const {
  normalizeDocumentType,
  normalizeTypeList,
  retrievalFamilyForType,
} = require("../document/documentTypes");
const {
  CHAT_REQUEST_LIMITS,
  addMessageWithSessionRecovery,
  beginGeneratedChatTurn,
  persistGeneratedChatResponse,
  resolveDocumentIdentity,
  sendGeneratedChatError,
  validateGeneratedChatPayload,
} = require("../document/documentChatRoute");
const {
  sanitizeList,
  sanitizeObject,
  sanitizeText,
} = require("../profile/profileService");

test("unified document chat supports current and future research types", () => {
  for (const type of [
    "bill",
    "act",
    "gazette",
    "policy",
    "committee_report",
    "rule",
    "notification",
    "circular",
    "debate",
    "strategy_paper",
    "white_paper",
    "manual",
    "report",
    "cabinet_decision",
    "press_release",
    "government_resolution",
    "recommendation",
    "discussion_paper",
  ]) {
    assert.equal(ALLOWED_DOCUMENT_TYPES.has(type), true);
    assert.equal(normalizeType(type.toUpperCase()), type);
  }
  assert.throws(() => normalizeType("password"), /Unsupported document type/);
});

test("RAG adapters share one contract for Bills, Acts, Gazettes, and Policies", () => {
  assert.deepEqual(Object.keys(TYPE_CONFIG), [
    "bill",
    "act",
    "gazette",
    "policy",
  ]);
  for (const config of Object.values(TYPE_CONFIG)) {
    assert.equal(typeof config.index, "function");
    assert.equal(typeof config.check, "function");
    assert.equal(typeof config.generateSummary, "function");
    assert.equal(typeof config.search, "function");
    assert.equal(typeof config.store, "function");
    assert.match(config.idField, /^(bill|act|gazette|policy)Id$/);
  }
});

test("document identity accepts bodyless GET requests", () => {
  assert.deepEqual(
    resolveDocumentIdentity({
      params: { documentType: "gazette", documentId: "20438" },
      query: {},
    }),
    {
      documentType: "gazette",
      documentId: "20438",
    },
  );
  assert.throws(
    () =>
      resolveDocumentIdentity({
        params: { documentType: "gazette" },
        query: {},
      }),
    /Document ID is required/,
  );
  assert.throws(
    () =>
      resolveDocumentIdentity({
        params: { documentType: "password", documentId: "20438" },
        query: {},
      }),
    /Unsupported document type/,
  );
});

test("chat message persistence recovers a missing source-only session", async () => {
  const calls = [];
  let sessionExists = false;
  const documentChat = {
    async addMessage(userId, documentType, documentId, message) {
      calls.push(["add", userId, documentType, documentId, message.text]);
      return sessionExists ? { id: "chat-1", messages: [message] } : null;
    },
    async findOrCreate(userId, document) {
      calls.push(["session", userId, document.documentType, document.documentId]);
      sessionExists = true;
      return { id: "chat-1" };
    },
  };
  const chat = await addMessageWithSessionRecovery({
    userId: "8",
    documentType: "policy",
    documentId: "24563",
    message: { text: "Compare the implementation duties", sender: "user" },
    documentChat,
    loadDocument: async () => ({ title: "PolicyEdge source", sourceUrl: "https://www.policyedge.in/p/example" }),
  });
  assert.equal(chat.id, "chat-1");
  assert.deepEqual(calls.map((call) => call[0]), ["add", "session", "add"]);
});

test("chat message persistence does not create duplicate sessions", async () => {
  let sessionCalls = 0;
  const existing = { id: "chat-existing" };
  const chat = await addMessageWithSessionRecovery({
    userId: "8",
    documentType: "bill",
    documentId: "3646",
    message: { text: "What changed?", sender: "user" },
    documentChat: {
      addMessage: async () => existing,
      findOrCreate: async () => { sessionCalls += 1; },
    },
    loadDocument: async () => { throw new Error("should not load"); },
  });
  assert.equal(chat, existing);
  assert.equal(sessionCalls, 0);
});

test("generated chat lifecycle survives refresh and re-login across document families", async () => {
  const chats = new Map();
  const keyFor = (userId, documentType, documentId) =>
    `${userId}:${documentType}:${documentId}`;
  const documentChat = {
    async findOrCreate(userId, document) {
      const key = keyFor(userId, document.documentType, document.documentId);
      if (!chats.has(key)) {
        chats.set(key, {
          id: `chat-${chats.size + 1}`,
          documentType: document.documentType,
          documentId: String(document.documentId),
          title: document.title,
          messages: [],
        });
      }
      return chats.get(key);
    },
    async addMessage(userId, documentType, documentId, message) {
      const chat = chats.get(keyFor(userId, documentType, documentId));
      if (!chat) return null;
      const normalized = {
        _id: message.id,
        text: message.text,
        sender: message.sender,
        sources: message.sources || [],
        metadata: message.metadata || {},
      };
      const existing = chat.messages.findIndex(
        (item) => item._id === normalized._id,
      );
      if (existing >= 0) chat.messages[existing] = normalized;
      else chat.messages.push(normalized);
      return chat;
    },
    async findOne(userId, documentType, documentId) {
      return chats.get(keyFor(userId, documentType, documentId)) || null;
    },
  };

  const families = [
    "bill",
    "act",
    "gazette",
    "policy",
    "report",
    "regulation",
    "notification",
    "circular",
  ];
  for (const [index, documentType] of families.entries()) {
    const documentId = String(10_000 + index);
    const requestId = `refresh-regression-${documentType}`;
    const question = `What does this ${documentType} establish?`;
    const displayMessage = documentType === "policy"
      ? "Run workflow: Executive brief"
      : question;
    const lifecycle = await beginGeneratedChatTurn({
      userId: "account-a",
      documentType,
      documentId,
      document: {
        title: `${documentType} persistence fixture`,
        sourceUrl: documentType === "policy"
          ? "https://www.policyedge.in/p/html-fixture"
          : "https://example.invalid/source",
      },
      message: question,
      displayMessage,
      requestId,
      responseLanguage: "English",
      documentChat,
    });
    const citation = {
      id: `${documentType}-source-1`,
      content: `Verified ${documentType} passage`,
    };
    await persistGeneratedChatResponse({
      lifecycle,
      userId: "account-a",
      documentType,
      documentId,
      text: `Grounded ${documentType} answer`,
      sources: [citation],
      metadata: { generationMode: "ai_verified" },
      documentChat,
    });

    // A page refresh and a new authenticated browser both resolve history by
    // the durable account + document identity, not by an in-memory session ID.
    const afterRefresh = await documentChat.findOne(
      "account-a",
      documentType,
      documentId,
    );
    const afterRelogin = await documentChat.findOne(
      "account-a",
      documentType,
      documentId,
    );
    assert.equal(afterRefresh, afterRelogin);
    assert.equal(afterRelogin.messages.length, 2);
    assert.equal(afterRelogin.messages[0].sender, "user");
    assert.equal(afterRelogin.messages[0].text, displayMessage);
    assert.equal(afterRelogin.messages[1].text, `Grounded ${documentType} answer`);
    assert.deepEqual(afterRelogin.messages[1].sources, [citation]);
    assert.equal(
      await documentChat.findOne("account-b", documentType, documentId),
      null,
      "chat history must remain account-scoped",
    );

    // A network retry with the same request ID replaces the same durable turn
    // instead of duplicating either message.
    const replayInput = {
      userId: "account-a",
      documentType,
      documentId,
      document: { title: `${documentType} persistence fixture` },
      message: question,
      displayMessage,
      requestId,
      documentChat,
    };
    const replays = await Promise.all([
      beginGeneratedChatTurn(replayInput),
      beginGeneratedChatTurn(replayInput),
    ]);
    await Promise.all(replays.map((replay) => persistGeneratedChatResponse({
      lifecycle: replay,
      userId: "account-a",
      documentType,
      documentId,
      text: `Grounded ${documentType} answer`,
      sources: [citation],
      documentChat,
    })));
    assert.equal(afterRelogin.messages.length, 2);
  }
});

test("concurrent identical request IDs share one durable generated result", async () => {
  const chat = {
    id: "chat-1",
    documentType: "bill",
    documentId: "3646",
    messages: [],
  };
  let generation = null;
  let claimsAcquired = 0;
  const documentChat = {
    async findOrCreate() { return chat; },
    async addMessage(_userId, _type, _id, message) {
      const normalized = { ...message, _id: message.id };
      const index = chat.messages.findIndex((item) => item._id === normalized._id);
      if (index >= 0) chat.messages[index] = normalized;
      else chat.messages.push(normalized);
      return chat;
    },
    async claimGeneration() {
      if (!generation || generation.status === "failed") {
        claimsAcquired += 1;
        generation = {
          status: "processing",
          owner_token: `owner-${claimsAcquired}`,
        };
        return { ...generation, claimAcquired: true };
      }
      return { ...generation, claimAcquired: false };
    },
    async getGeneration() { return generation; },
    async completeGeneration(_user, _type, _id, _request, owner, response) {
      assert.equal(owner, generation.owner_token);
      generation = { status: "completed", response_json: response };
      return generation;
    },
    async failGeneration() {
      generation = { status: "failed" };
      return true;
    },
  };
  const input = {
    userId: "8",
    documentType: "bill",
    documentId: "3646",
    document: { title: "Bill fixture" },
    message: "What changed?",
    requestId: "same-request",
    documentChat,
  };
  const owner = await beginGeneratedChatTurn(input);
  const duplicatePromise = beginGeneratedChatTurn(input);
  const persistence = await persistGeneratedChatResponse({
    lifecycle: owner,
    userId: "8",
    documentType: "bill",
    documentId: "3646",
    text: "One durable answer",
    sources: [{ id: "D1-C1", content: "Cited text" }],
    documentChat,
  });
  const duplicate = await duplicatePromise;
  assert.equal(claimsAcquired, 1);
  assert.equal(duplicate.claimAcquired, false);
  assert.equal(duplicate.reusedResponse.text, "One durable answer");
  assert.deepEqual(duplicate.reusedResponse.sources, [
    { id: "D1-C1", content: "Cited text" },
  ]);
  assert.deepEqual(duplicate.reusedResponse.persistence, persistence);
  assert.equal(chat.messages.length, 2);

  // A failed owner releases the request ID for an explicit retry.
  generation = { status: "failed" };
  const retry = await beginGeneratedChatTurn(input);
  assert.equal(retry.claimAcquired, true);
  assert.equal(claimsAcquired, 2);
  assert.match(CLAIM_CHAT_GENERATION_SQL, /status = 'failed'/);
});

test("generation lifecycle fails explicitly when durable persistence is unavailable", async () => {
  await assert.rejects(
    beginGeneratedChatTurn({
      userId: "8",
      documentType: "bill",
      documentId: "3646",
      document: { title: "Bill fixture" },
      message: "What changed?",
      requestId: "persistence-failure",
      documentChat: {
        findOrCreate: async () => ({ id: "chat-1" }),
        addMessage: async () => null,
      },
    }),
    (error) => {
      assert.equal(error.status, 500);
      assert.equal(error.failureCode, "CHAT_PERSISTENCE_FAILED");
      assert.match(error.publicMessage, /could not be saved/i);
      return true;
    },
  );
});

test("a cleared conversation rejects an in-flight turn from the previous epoch", async () => {
  await assert.rejects(
    beginGeneratedChatTurn({
      userId: "8",
      documentType: "bill",
      documentId: "3646",
      document: { title: "Bill fixture" },
      message: "What changed?",
      requestId: "stale-after-clear",
      conversationEpoch: 3,
      documentChat: {
        findOrCreate: async () => ({ id: "chat-1", conversationEpoch: 4 }),
      },
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.failureCode, "CHAT_CONVERSATION_CLEARED");
      return true;
    },
  );
});

test("generated chat request limits reject oversized and malformed payloads", () => {
  const valid = validateGeneratedChatPayload({
    message: "Explain section 7",
    displayMessage: "Explain section 7",
    responseLanguage: "English",
    sourceIds: [1, "2", "2"],
    workflow: { id: "brief", title: "Executive brief", group: "analysis" },
  });
  assert.equal(valid.message, "Explain section 7");
  assert.deepEqual(valid.sourceIds, ["1", "2"]);
  assert.equal(valid.conversationEpoch, null);

  const rejects = (payload, status, code) => assert.throws(
    () => validateGeneratedChatPayload(payload),
    (error) => {
      assert.equal(error.status, status);
      assert.equal(error.failureCode, code);
      return true;
    },
  );
  rejects({ message: { unsafe: true } }, 422, "INVALID_CHAT_PAYLOAD");
  rejects({
    message: "x".repeat(CHAT_REQUEST_LIMITS.questionChars + 1),
  }, 413, "CHAT_MESSAGE_TOO_LARGE");
  rejects({
    message: "valid",
    displayMessage: "x".repeat(CHAT_REQUEST_LIMITS.displayMessageChars + 1),
  }, 413, "CHAT_DISPLAY_MESSAGE_TOO_LARGE");
  rejects({ message: "valid", workflow: [] }, 422, "INVALID_CHAT_WORKFLOW");
  rejects({
    message: "valid",
    workflow: { title: "x".repeat(CHAT_REQUEST_LIMITS.workflowTitleChars + 1) },
  }, 413, "CHAT_WORKFLOW_TOO_LARGE");
  rejects({ message: "valid", sourceIds: "1,2" }, 422, "INVALID_CHAT_SOURCES");
  rejects({ message: "valid", conversationEpoch: -1 }, 422, "INVALID_CHAT_CONVERSATION_EPOCH");
  rejects({ message: "valid", conversationEpoch: 1.2 }, 422, "INVALID_CHAT_CONVERSATION_EPOCH");
  rejects({
    message: "valid",
    sourceIds: Array.from(
      { length: CHAT_REQUEST_LIMITS.sourceIds + 1 },
      (_, index) => index + 1,
    ),
  }, 413, "CHAT_SOURCES_TOO_LARGE");
});

test("chat storage rejects oversized answer text, citations, and metadata", () => {
  const rejects = (message, status, code) => assert.throws(
    () => validateChatMessageData(message),
    (error) => {
      assert.equal(error.status, status);
      assert.equal(error.failureCode, code);
      return true;
    },
  );
  assert.deepEqual(validateChatMessageData({
    text: "Grounded answer",
    sender: "assistant",
  }), {
    metadata: {},
    sources: [],
  });
  rejects({
    text: "x".repeat(CHAT_STORAGE_LIMITS.messageChars + 1),
    sender: "assistant",
  }, 413, "CHAT_MESSAGE_TOO_LARGE");
  rejects({
    text: "answer",
    sender: "assistant",
    sources: Array.from(
      { length: CHAT_STORAGE_LIMITS.sources + 1 },
      (_, index) => ({ id: `source-${index}` }),
    ),
  }, 413, "CHAT_SOURCES_TOO_LARGE");
  rejects({
    text: "answer",
    sender: "assistant",
    sources: [{ content: "x".repeat(CHAT_STORAGE_LIMITS.sourcesBytes) }],
  }, 413, "CHAT_SOURCES_TOO_LARGE");
  rejects({
    text: "answer",
    sender: "assistant",
    metadata: { diagnostics: "x".repeat(CHAT_STORAGE_LIMITS.metadataBytes) },
  }, 413, "CHAT_METADATA_TOO_LARGE");
  rejects({ text: "answer", sender: "assistant", metadata: [] }, 422, "INVALID_CHAT_METADATA");
  rejects({ text: "answer", sender: "system" }, 422, "INVALID_CHAT_SENDER");
  rejects({
    text: "answer",
    sender: "user",
    id: "invalid message id",
  }, 422, "INVALID_CHAT_MESSAGE_ID");
  rejects({
    text: "answer",
    sender: "user",
    timestamp: "not-a-date",
  }, 422, "INVALID_CHAT_TIMESTAMP");
  assert.equal(CHAT_STORAGE_LIMITS.messagesPerChat, 200);
  assert.match(UPSERT_CHAT_MESSAGE_SQL, /candidate_count - \$6::integer/);
  assert.match(UPSERT_CHAT_MESSAGE_SQL, /conversation_epoch = \$7::bigint/);
});

test("generation-result cleanup is bounded and never removes active claims", async () => {
  const calls = [];
  const result = await cleanupGenerationClaims({
    perDocument: 99_999,
    replayDays: 0,
    batchSize: 99_999,
    queryFn: async (sql, params) => {
      calls.push({ sql, params });
      return { rowCount: 17 };
    },
  });
  assert.deepEqual(result, {
    deleted: 17,
    perDocument: 500,
    replayDays: CHAT_GENERATION_RETENTION.replayDays,
    batchSize: 1_000,
    staleProcessingMinutes: CHAT_GENERATION_RETENTION.staleProcessingMinutes,
  });
  assert.deepEqual(calls[0].params, [500, 7, 60, 1_000]);
  assert.match(CLEANUP_CHAT_GENERATIONS_SQL, /status IN \('completed', 'failed'\)/);
  assert.match(CLEANUP_CHAT_GENERATIONS_SQL, /status = 'processing'/);
  assert.match(CLEANUP_CHAT_GENERATIONS_SQL, /LIMIT \$4::integer/);
  assert.match(PRUNE_CHAT_GENERATIONS_SQL, /OFFSET \$4::integer/);
});

test("clear chat atomically removes messages and generation replay payloads", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/UPDATE document_chats/.test(sql)) {
        return {
          rows: [{
            id: 1,
            document_type: "bill",
            document_id: "3646",
            document_title: "Fixture",
            messages: [],
            metadata_json: {},
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    },
    release() { calls.push({ sql: "RELEASE" }); },
  };
  const cleared = await clear("8", "bill", "3646", {
    ensureDb: async () => undefined,
    pool: { connect: async () => client },
  });
  assert.deepEqual(cleared.messages, []);
  assert.equal(calls[0].sql, "BEGIN");
  assert.match(calls[1].sql, /SET messages = '\[\]'::jsonb/);
  assert.match(calls[1].sql, /conversation_epoch = conversation_epoch \+ 1/);
  assert.equal(calls[2].sql, CLEAR_CHAT_GENERATIONS_SQL);
  assert.deepEqual(calls[2].params, ["8", "bill", "3646"]);
  assert.equal(calls[3].sql, "COMMIT");
  assert.equal(calls[4].sql, "RELEASE");
});

test("clear chat rolls back message removal when replay cleanup fails", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql === CLEAR_CHAT_GENERATIONS_SQL) throw new Error("cleanup failed");
      if (/UPDATE document_chats/.test(sql)) return { rows: [{ messages: [] }] };
      return { rows: [] };
    },
    release() { calls.push("RELEASE"); },
  };
  await assert.rejects(
    clear("8", "bill", "3646", {
      ensureDb: async () => undefined,
      pool: { connect: async () => client },
    }),
    /cleanup failed/,
  );
  assert.ok(calls.includes("ROLLBACK"));
  assert.ok(!calls.includes("COMMIT"));
  assert.equal(calls.at(-1), "RELEASE");
});

test("generated chat hides pre-stream persistence and database errors", () => {
  const response = {
    headersSent: false,
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const error = new Error("duplicate key value exposes production schema detail");
  sendGeneratedChatError(response, error);
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error, "Internal server error.");
  assert.ok(response.body.requestId);
  assert.doesNotMatch(JSON.stringify(response.body), /schema detail/);

  const streamed = {
    headersSent: true,
    destroyed: false,
    writableEnded: false,
    writes: [],
    write(value) {
      this.writes.push(value);
      return true;
    },
    end() {
      this.writableEnded = true;
    },
  };
  sendGeneratedChatError(
    streamed,
    new Error("password=hunter2 leaked after SSE headers"),
  );
  assert.match(streamed.writes[0], /Response generation failed/);
  assert.match(streamed.writes[0], /requestId/);
  assert.doesNotMatch(streamed.writes[0], /hunter2|leaked after SSE/);
});

test("universal document types use aliases and one retrieval mapping", () => {
  assert.equal(normalizeDocumentType("committee-report"), "committee_report");
  assert.equal(normalizeDocumentType("office-memoranda"), "office_memorandum");
  assert.deepEqual(normalizeTypeList("bill,act,rules"), [
    "bill",
    "act",
    "rule",
  ]);
  assert.equal(retrievalFamilyForType("bill"), "bill");
  assert.equal(retrievalFamilyForType("act"), "act");
  assert.equal(retrievalFamilyForType("policy"), "policy");
});

test("universal repository filters remain parameterized across all fields", () => {
  const filters = buildFilters({
    type: "committee-report",
    search: "tax' OR TRUE --",
    ministry: "Finance",
    authority: "CBDT",
    hasPdf: "true",
    semanticIds: ["12", "13"],
  });
  assert.equal(filters.where.includes("tax' OR TRUE"), false);
  assert.match(filters.where, /document_type = ANY/);
  assert.match(filters.where, /search_vector/);
  assert.doesNotMatch(
    filters.where,
    /id::TEXT = ANY/,
    "semantic matches must remain suggestions when lexical search is present",
  );
  assert.match(filters.where, /pdf_url IS NOT NULL/);
  assert.deepEqual(filters.parameters[0], ["committee_report"]);

  const semanticOnly = buildFilters({ semanticIds: ["12", "13"] });
  assert.match(semanticOnly.where, /id::TEXT = ANY/);
});

test("policy search accepts legacy and current PolicyEdge source identities", () => {
  const filters = buildFilters({
    type: "policy",
    source: "policyedge",
    search: "data protection",
  });
  assert.match(filters.where, /document_type = ANY/);
  assert.match(filters.where, /= ANY\(/);
  assert.deepEqual(filters.parameters[0], ["policy", "report"]);
});

test("policy libraries separate national and state records without new tables", () => {
  const national = buildFilters({
    type: "policy,scheme,guideline",
    scope: "policy-national",
  });
  const state = buildFilters({
    type: "policy,scheme,guideline",
    scope: "policy-state",
  });
  assert.match(national.where, /jurisdiction_level IS NULL/);
  assert.match(national.where, /jurisdiction_level <> 'state'/);
  assert.match(state.where, /jurisdiction_level = 'state'/);
  assert.deepEqual(national.parameters[0], [
    "policy",
    "scheme",
    "guideline",
  ]);
});

test("universal repository exposes the stable document contract", () => {
  const document = mapDocument({
    id: 42,
    canonical_id: "rashtram-42",
    title: "Sample Rule",
    document_type: "rule",
    category: "Tax",
    authority: "CBDT",
    jurisdiction: "India",
    jurisdiction_level: "parliament",
    ministry: "Finance",
    publication_date: "2026-06-29",
    status: "Published",
    canonical_source: "egazette",
    canonical_url: "https://example.invalid/source",
    pdf_url: "https://example.invalid/rule.pdf",
    metadata_json: { language: "English" },
  });
  assert.equal(document.id, "42");
  assert.equal(document.type, "rule");
  assert.equal(document.subtype, "Tax");
  assert.equal(document.source, "egazette");
  assert.equal(document.pdfUrl, "https://example.invalid/rule.pdf");
  assert.equal(document.readiness, "pdf_available");
  assert.equal(document.researchReady, false);
  assert.deepEqual(document.metadata, { language: "English" });
  assert.deepEqual(document.relationships, []);
});

test("newest and oldest sorting use the complete deterministic date fallback", () => {
  for (const column of [
    "publication_date",
    "introduced_date",
    "passed_date",
    "enacted_date",
    "first_seen_at",
    "updated_at",
    "created_at",
  ]) {
    assert.match(DOCUMENT_DATE_EXPRESSION, new RegExp(column));
  }
  assert.match(DOCUMENT_DATE_EXPRESSION, /MAKE_DATE\(year, 1, 1\)/);
});

test("document readiness never presents an unindexed or failed PDF as ready", () => {
  const failed = mapDocument({
    id: 1,
    title: "Unreadable notification",
    document_type: "notification",
    pdf_url: "https://example.invalid/broken.pdf",
    source_url: "https://example.invalid/source",
    processing_status: "failed",
    processing_error: "PDF extraction failed",
  });
  const ready = mapDocument({
    id: 2,
    title: "Indexed Act",
    document_type: "act",
    pdf_url: "https://example.invalid/act.pdf",
    research_ready: true,
  });
  const sourceOnly = mapDocument({
    id: 3,
    title: "Source record",
    document_type: "policy",
    source_url: "https://example.invalid/policy",
  });
  assert.equal(failed.readiness, "processing_failed");
  assert.equal(failed.researchReady, false);
  assert.equal(ready.readiness, "research_ready");
  assert.equal(ready.researchReady, true);
  assert.equal(sourceOnly.readiness, "source_only");
});

test("profile input helpers bound and normalize user-controlled fields", () => {
  assert.equal(sanitizeText("  Researcher  ", 20), "Researcher");
  assert.equal(sanitizeText("x".repeat(50), 10), "x".repeat(10));
  assert.deepEqual(
    sanitizeList([" Tax ", "Tax", "", "Environment"]),
    ["Tax", "Environment"],
  );
  assert.deepEqual(sanitizeList("not-an-array"), []);
  assert.deepEqual(sanitizeObject({ email: true }), { email: true });
  assert.deepEqual(sanitizeObject(["not", "an", "object"]), {});
});
