const crypto = require("crypto");
const { connectDB, getPool, query } = require("../db");

const {
  DOCUMENT_TYPES,
  normalizeDocumentType,
} = require("../document/documentTypes");

const ALLOWED_DOCUMENT_TYPES = DOCUMENT_TYPES;

const CHAT_STORAGE_LIMITS = Object.freeze({
  messageChars: 80_000,
  messagesPerChat: 200,
  sources: 64,
  sourcesBytes: 192 * 1024,
  metadataBytes: 96 * 1024,
});

const CHAT_GENERATION_RETENTION = Object.freeze({
  perDocument: 200,
  replayDays: 7,
  cleanupBatchSize: 500,
  staleProcessingMinutes: 60,
});

const chatStorageError = (status, failureCode, message) => {
  const error = new Error(message);
  error.status = status;
  error.failureCode = failureCode;
  return error;
};

const boundedJson = (value, maximumBytes, failureCode, label) => {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw chatStorageError(
      422,
      "INVALID_CHAT_MESSAGE",
      `${label} must be valid JSON.`,
    );
  }
  if (serialized === undefined) {
    throw chatStorageError(
      422,
      "INVALID_CHAT_MESSAGE",
      `${label} must be valid JSON.`,
    );
  }
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw chatStorageError(
      413,
      failureCode,
      `${label} exceeds the supported storage limit.`,
    );
  }
  return serialized;
};

const normalizeType = (value) => {
  return normalizeDocumentType(value);
};

const mapRow = (row) =>
  row
    ? {
        id: String(row.id),
        documentType: row.document_type,
        documentId: row.document_id,
        title: row.document_title,
        status: row.status,
        pdfUrl: row.pdf_url,
        sourceUrl: row.source_url,
        summary: row.summary,
        messages: row.messages || [],
        metadata: row.metadata_json || {},
        isPinned: row.is_pinned,
        isActive: row.is_active,
        lastMessageAt: row.last_message_at,
        lastAccessedAt: row.last_accessed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        conversationEpoch: Number(row.conversation_epoch || 0),
      }
    : null;

const findOrCreate = async (userId, document) => {
  const documentType = normalizeType(document.documentType);
  const result = await query(
    `INSERT INTO document_chats (
       user_id, document_type, document_id, document_title, status,
       pdf_url, source_url, summary, metadata_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (user_id, document_type, document_id)
     DO UPDATE SET
       document_title = EXCLUDED.document_title,
       status = COALESCE(EXCLUDED.status, document_chats.status),
       pdf_url = COALESCE(EXCLUDED.pdf_url, document_chats.pdf_url),
       source_url = COALESCE(EXCLUDED.source_url, document_chats.source_url),
       summary = COALESCE(EXCLUDED.summary, document_chats.summary),
       metadata_json = document_chats.metadata_json || EXCLUDED.metadata_json,
       is_active = TRUE,
       last_accessed_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      documentType,
      String(document.documentId),
      document.title,
      document.status || null,
      document.pdfUrl || null,
      document.sourceUrl || null,
      document.summary || null,
      JSON.stringify(document.metadata || {}),
    ],
  );
  return mapRow(result.rows[0]);
};

const findOne = async (userId, documentType, documentId) => {
  const result = await query(
    `SELECT *
     FROM document_chats
     WHERE user_id = $1
       AND document_type = $2
       AND document_id = $3
       AND is_active = TRUE
     LIMIT 1`,
    [userId, normalizeType(documentType), String(documentId)],
  );
  if (result.rows[0]) {
    await query(
      `UPDATE document_chats
       SET last_accessed_at = NOW()
       WHERE id = $1`,
      [result.rows[0].id],
    );
  }
  return mapRow(result.rows[0]);
};

const validateChatMessageData = (messageData) => {
  if (typeof messageData?.text !== "string") {
    throw chatStorageError(
      422,
      "INVALID_CHAT_MESSAGE",
      "Chat message text is required.",
    );
  }
  if (messageData.text.length > CHAT_STORAGE_LIMITS.messageChars) {
    throw chatStorageError(
      413,
      "CHAT_MESSAGE_TOO_LARGE",
      `Chat messages are limited to ${CHAT_STORAGE_LIMITS.messageChars.toLocaleString("en-US")} characters.`,
    );
  }
  if (!["user", "assistant"].includes(messageData.sender)) {
    throw chatStorageError(
      422,
      "INVALID_CHAT_SENDER",
      "Chat message sender must be user or assistant.",
    );
  }
  const suppliedId = messageData._id ?? messageData.id;
  if (
    suppliedId !== undefined && (
      typeof suppliedId !== "string" ||
      !/^[a-zA-Z0-9._:-]{1,120}$/.test(suppliedId)
    )
  ) {
    throw chatStorageError(
      422,
      "INVALID_CHAT_MESSAGE_ID",
      "Chat message ID is invalid.",
    );
  }
  if (
    messageData.timestamp !== undefined && (
      typeof messageData.timestamp !== "string" ||
      messageData.timestamp.length > 40 ||
      !Number.isFinite(Date.parse(messageData.timestamp))
    )
  ) {
    throw chatStorageError(
      422,
      "INVALID_CHAT_TIMESTAMP",
      "Chat message timestamp must be a valid date.",
    );
  }
  if (!Array.isArray(messageData.sources || [])) {
    throw chatStorageError(
      422,
      "INVALID_CHAT_SOURCES",
      "Chat citations must be an array.",
    );
  }
  const sources = messageData.sources || [];
  if (sources.length > CHAT_STORAGE_LIMITS.sources) {
    throw chatStorageError(
      413,
      "CHAT_SOURCES_TOO_LARGE",
      `Chat answers can retain at most ${CHAT_STORAGE_LIMITS.sources} citations.`,
    );
  }
  boundedJson(
    sources,
    CHAT_STORAGE_LIMITS.sourcesBytes,
    "CHAT_SOURCES_TOO_LARGE",
    "Chat citations",
  );
  const metadata = messageData.metadata === undefined
    ? {}
    : messageData.metadata;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    throw chatStorageError(
      422,
      "INVALID_CHAT_METADATA",
      "Chat metadata must be a structured object.",
    );
  }
  boundedJson(
    metadata,
    CHAT_STORAGE_LIMITS.metadataBytes,
    "CHAT_METADATA_TOO_LARGE",
    "Chat metadata",
  );
  return { metadata, sources };
};

const UPSERT_CHAT_MESSAGE_SQL = `UPDATE document_chats
 SET messages = (
       SELECT COALESCE(
         JSONB_AGG(candidate_message ORDER BY message_position)
           FILTER (
             WHERE message_position >
               GREATEST(candidate_count - $6::integer, 0)
           ),
         '[]'::jsonb
       )
       FROM (
         SELECT candidate_message,
                message_position,
                COUNT(*) OVER () AS candidate_count
         FROM JSONB_ARRAY_ELEMENTS(
           CASE
             WHEN EXISTS (
               SELECT 1
               FROM JSONB_ARRAY_ELEMENTS(messages) existing_message
               WHERE existing_message ->> '_id' = $1
             ) THEN (
               SELECT COALESCE(
                 JSONB_AGG(
                   CASE
                     WHEN existing_message ->> '_id' = $1
                       THEN $2::jsonb -> 0
                     ELSE existing_message
                   END
                   ORDER BY stored_position
                 ),
                 '[]'::jsonb
               )
               FROM JSONB_ARRAY_ELEMENTS(messages)
                 WITH ORDINALITY AS stored_message(
                   existing_message,
                   stored_position
                 )
             )
             ELSE messages || $2::jsonb
           END
         ) WITH ORDINALITY AS candidate(candidate_message, message_position)
       ) bounded_messages
     ),
     last_message_at = NOW(),
     last_accessed_at = NOW(),
     updated_at = NOW()
 WHERE user_id = $3
   AND document_type = $4
   AND document_id = $5
   AND is_active = TRUE
   AND ($7::bigint IS NULL OR conversation_epoch = $7::bigint)
 RETURNING *`;

const addMessage = async (
  userId,
  documentType,
  documentId,
  messageData,
) => {
  const { metadata, sources } = validateChatMessageData(messageData);
  const message = {
    _id: messageData._id || messageData.id || crypto.randomUUID(),
    text: messageData.text,
    sender: messageData.sender,
    timestamp: messageData.timestamp
      ? new Date(messageData.timestamp).toISOString()
      : new Date().toISOString(),
    sources,
    metadata,
    isError: Boolean(messageData.isError),
  };
  const result = await query(
    UPSERT_CHAT_MESSAGE_SQL,
    [
      message._id,
      JSON.stringify([message]),
      userId,
      normalizeType(documentType),
      String(documentId),
      CHAT_STORAGE_LIMITS.messagesPerChat,
      Number.isSafeInteger(Number(messageData.conversationEpoch))
        ? Number(messageData.conversationEpoch)
        : null,
    ],
  );
  return mapRow(result.rows[0]);
};

const CLAIM_CHAT_GENERATION_SQL = `INSERT INTO document_chat_generations AS generation_claim (
  user_id, document_type, document_id, request_id, status, owner_token
)
VALUES ($1, $2, $3, $4, 'processing', $5)
ON CONFLICT (user_id, document_type, document_id, request_id)
DO UPDATE SET
  status = 'processing',
  owner_token = EXCLUDED.owner_token,
  response_json = NULL,
  started_at = NOW(),
  completed_at = NULL,
  updated_at = NOW()
WHERE generation_claim.status = 'failed'
   OR (
     generation_claim.status = 'processing'
     AND generation_claim.updated_at < NOW() - INTERVAL '15 minutes'
   )
RETURNING status, owner_token, response_json, TRUE AS claim_acquired`;

const CLAIM_CHAT_GENERATION_AT_EPOCH_SQL = `INSERT INTO document_chat_generations AS generation_claim (
  user_id, document_type, document_id, request_id, status, owner_token,
  conversation_epoch
)
VALUES ($1, $2, $3, $4, 'processing', $5, $6)
ON CONFLICT (user_id, document_type, document_id, request_id)
DO UPDATE SET
  status = 'processing',
  owner_token = EXCLUDED.owner_token,
  response_json = NULL,
  conversation_epoch = EXCLUDED.conversation_epoch,
  started_at = NOW(),
  completed_at = NULL,
  updated_at = NOW()
WHERE generation_claim.conversation_epoch = EXCLUDED.conversation_epoch
  AND (
    generation_claim.status = 'failed'
    OR (
      generation_claim.status = 'processing'
      AND generation_claim.updated_at < NOW() - INTERVAL '15 minutes'
    )
  )
RETURNING status, owner_token, response_json, conversation_epoch,
  TRUE AS claim_acquired`;

const PRUNE_CHAT_GENERATIONS_SQL = `DELETE FROM document_chat_generations generation
 WHERE generation.user_id = $1
   AND generation.document_type = $2
   AND generation.document_id = $3
   AND generation.status IN ('completed', 'failed')
   AND generation.request_id IN (
     SELECT request_id
       FROM document_chat_generations
      WHERE user_id = $1 AND document_type = $2 AND document_id = $3
        AND status IN ('completed', 'failed')
      ORDER BY updated_at DESC, request_id DESC
      OFFSET $4::integer
   )`;

const CLEANUP_CHAT_GENERATIONS_SQL = `WITH ranked_terminal AS (
  SELECT user_id, document_type, document_id, request_id, status, updated_at,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, document_type, document_id
           ORDER BY updated_at DESC, request_id DESC
         ) AS document_position
    FROM document_chat_generations
   WHERE status IN ('completed', 'failed')
), terminal_candidates AS (
  SELECT user_id, document_type, document_id, request_id, status, updated_at
    FROM ranked_terminal
   WHERE status IN ('completed', 'failed')
     AND (
       document_position > $1::integer
       OR updated_at < NOW() - ($2::integer * INTERVAL '1 day')
     )
), stale_processing_candidates AS (
  SELECT user_id, document_type, document_id, request_id, status, updated_at
    FROM document_chat_generations
   WHERE status = 'processing'
     AND updated_at < NOW() - ($3::integer * INTERVAL '1 minute')
), cleanup_candidates AS (
  SELECT user_id, document_type, document_id, request_id, status, updated_at
    FROM (
      SELECT * FROM terminal_candidates
      UNION ALL
      SELECT * FROM stale_processing_candidates
    ) eligible
   ORDER BY updated_at ASC
   LIMIT $4::integer
)
DELETE FROM document_chat_generations generation
 USING cleanup_candidates candidate
 WHERE generation.user_id = candidate.user_id
   AND generation.document_type = candidate.document_type
   AND generation.document_id = candidate.document_id
   AND generation.request_id = candidate.request_id
   AND (
     generation.status IN ('completed', 'failed')
     OR (
       generation.status = 'processing'
       AND generation.updated_at < NOW() - ($3::integer * INTERVAL '1 minute')
     )
   )
RETURNING generation.request_id, generation.status`;

const CLEAR_CHAT_GENERATIONS_SQL = `DELETE FROM document_chat_generations
 WHERE user_id = $1 AND document_type = $2 AND document_id = $3`;

const boundedInteger = (value, fallback, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10) || fallback));

const cleanupGenerationClaims = async ({
  perDocument = CHAT_GENERATION_RETENTION.perDocument,
  replayDays = CHAT_GENERATION_RETENTION.replayDays,
  batchSize = CHAT_GENERATION_RETENTION.cleanupBatchSize,
  staleProcessingMinutes = CHAT_GENERATION_RETENTION.staleProcessingMinutes,
  queryFn = query,
} = {}) => {
  const safePerDocument = boundedInteger(perDocument, 200, 25, 500);
  const safeReplayDays = boundedInteger(replayDays, 7, 1, 30);
  const safeBatchSize = boundedInteger(batchSize, 500, 1, 1_000);
  const safeStaleProcessingMinutes = boundedInteger(
    staleProcessingMinutes,
    CHAT_GENERATION_RETENTION.staleProcessingMinutes,
    30,
    24 * 60,
  );
  const result = await queryFn(CLEANUP_CHAT_GENERATIONS_SQL, [
    safePerDocument,
    safeReplayDays,
    safeStaleProcessingMinutes,
    safeBatchSize,
  ]);
  return {
    deleted: result.rowCount,
    perDocument: safePerDocument,
    replayDays: safeReplayDays,
    batchSize: safeBatchSize,
    staleProcessingMinutes: safeStaleProcessingMinutes,
  };
};

const validateGenerationIdentity = (requestId, ownerToken = undefined) => {
  if (
    typeof requestId !== "string" ||
    !/^[a-zA-Z0-9._:-]{1,80}$/.test(requestId)
  ) {
    throw chatStorageError(
      422,
      "INVALID_CHAT_REQUEST_ID",
      "Chat request ID is invalid.",
    );
  }
  if (
    ownerToken !== undefined && (
      typeof ownerToken !== "string" ||
      ownerToken.length < 1 ||
      ownerToken.length > 120
    )
  ) {
    throw chatStorageError(
      422,
      "INVALID_CHAT_OWNER_TOKEN",
      "Chat generation owner is invalid.",
    );
  }
};

const generationKey = (userId, documentType, documentId, requestId) => [
  userId,
  normalizeType(documentType),
  String(documentId),
  requestId,
];

const getGeneration = async (userId, documentType, documentId, requestId) => {
  validateGenerationIdentity(requestId);
  const result = await query(
    `SELECT status, owner_token, response_json, conversation_epoch,
            started_at, completed_at, updated_at
       FROM document_chat_generations
      WHERE user_id = $1 AND document_type = $2
        AND document_id = $3 AND request_id = $4`,
    generationKey(userId, documentType, documentId, requestId),
  );
  return result.rows[0] || null;
};

const claimGeneration = async (
  userId,
  documentType,
  documentId,
  requestId,
  conversationEpoch = null,
) => {
  validateGenerationIdentity(requestId);
  const ownerToken = crypto.randomUUID();
  const key = generationKey(userId, documentType, documentId, requestId);
  const hasEpoch = Number.isSafeInteger(Number(conversationEpoch)) &&
    Number(conversationEpoch) >= 0;
  const claimed = await query(
    hasEpoch ? CLAIM_CHAT_GENERATION_AT_EPOCH_SQL : CLAIM_CHAT_GENERATION_SQL,
    hasEpoch
      ? [...key, ownerToken, Number(conversationEpoch)]
      : [...key, ownerToken],
  );
  if (claimed.rows[0]) return { ...claimed.rows[0], claimAcquired: true };
  const existing = await getGeneration(userId, documentType, documentId, requestId);
  return { ...existing, claimAcquired: false };
};

const completeGeneration = async (
  userId,
  documentType,
  documentId,
  requestId,
  ownerToken,
  response,
) => {
  validateGenerationIdentity(requestId, ownerToken);
  const serialized = boundedJson(
    response,
    CHAT_STORAGE_LIMITS.messageChars +
      CHAT_STORAGE_LIMITS.sourcesBytes +
      CHAT_STORAGE_LIMITS.metadataBytes,
    "CHAT_GENERATION_RESULT_TOO_LARGE",
    "Chat generation result",
  );
  const result = await query(
    `UPDATE document_chat_generations
        SET status = 'completed', response_json = $1::jsonb,
            completed_at = NOW(), updated_at = NOW()
      WHERE user_id = $2 AND document_type = $3 AND document_id = $4
        AND request_id = $5 AND owner_token = $6 AND status = 'processing'
      RETURNING status, response_json`,
    [
      serialized,
      ...generationKey(userId, documentType, documentId, requestId),
      ownerToken,
    ],
  );
  return result.rows[0] || null;
};

const completeGeneratedResponse = async ({
  userId,
  documentType,
  documentId,
  requestId,
  ownerToken,
  conversationEpoch = null,
  messageData,
}) => {
  validateGenerationIdentity(requestId, ownerToken);
  const { metadata, sources } = validateChatMessageData(messageData);
  const message = {
    _id: messageData._id || messageData.id || requestId,
    text: messageData.text,
    sender: messageData.sender,
    timestamp: messageData.timestamp
      ? new Date(messageData.timestamp).toISOString()
      : new Date().toISOString(),
    sources,
    metadata,
    isError: Boolean(messageData.isError),
  };
  await connectDB();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const chatResult = await client.query(UPSERT_CHAT_MESSAGE_SQL, [
      message._id,
      JSON.stringify([message]),
      userId,
      normalizeType(documentType),
      String(documentId),
      CHAT_STORAGE_LIMITS.messagesPerChat,
      Number.isSafeInteger(Number(conversationEpoch))
        ? Number(conversationEpoch)
        : null,
    ]);
    const chat = mapRow(chatResult.rows[0]);
    if (!chat) {
      throw chatStorageError(
        409,
        "CHAT_CONVERSATION_CLEARED",
        "This conversation was cleared. Please submit the question again.",
      );
    }
    const persistence = {
      saved: true,
      chatId: chat.id,
      conversationId: chat.id,
      turnId: requestId,
      userMessageId: `${requestId}:user`,
      assistantMessageId: message._id,
      conversationEpoch: chat.conversationEpoch,
    };
    const response = {
      text: message.text,
      sources: message.sources,
      metadata: message.metadata,
      persistence,
    };
    const serialized = boundedJson(
      response,
      CHAT_STORAGE_LIMITS.messageChars +
        CHAT_STORAGE_LIMITS.sourcesBytes +
        CHAT_STORAGE_LIMITS.metadataBytes,
      "CHAT_GENERATION_RESULT_TOO_LARGE",
      "Chat generation result",
    );
    const generationResult = await client.query(
      `UPDATE document_chat_generations
          SET status = 'completed', response_json = $1::jsonb,
              completed_at = NOW(), updated_at = NOW()
        WHERE user_id = $2 AND document_type = $3 AND document_id = $4
          AND request_id = $5 AND owner_token = $6 AND status = 'processing'
          AND ($7::bigint IS NULL OR conversation_epoch = $7::bigint)
        RETURNING status`,
      [
        serialized,
        ...generationKey(userId, documentType, documentId, requestId),
        ownerToken,
        Number.isSafeInteger(Number(conversationEpoch))
          ? Number(conversationEpoch)
          : null,
      ],
    );
    if (!generationResult.rows[0]) {
      throw chatStorageError(
        409,
        "CHAT_GENERATION_CLAIM_LOST",
        "Chat generation ownership expired.",
      );
    }
    await client.query(PRUNE_CHAT_GENERATIONS_SQL, [
      userId,
      normalizeType(documentType),
      String(documentId),
      CHAT_GENERATION_RETENTION.perDocument,
    ]);
    await client.query("COMMIT");
    return { chat, persistence, response };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const failGeneration = async (
  userId,
  documentType,
  documentId,
  requestId,
  ownerToken,
) => {
  validateGenerationIdentity(requestId, ownerToken);
  await connectDB();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE document_chat_generations
          SET status = 'failed', response_json = NULL, updated_at = NOW()
        WHERE user_id = $1 AND document_type = $2 AND document_id = $3
          AND request_id = $4 AND owner_token = $5 AND status = 'processing'
        RETURNING status`,
      [...generationKey(userId, documentType, documentId, requestId), ownerToken],
    );
    await client.query(PRUNE_CHAT_GENERATIONS_SQL, [
      userId,
      normalizeType(documentType),
      String(documentId),
      CHAT_GENERATION_RETENTION.perDocument,
    ]);
    await client.query("COMMIT");
    return Boolean(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const updateSummary = async (
  userId,
  documentType,
  documentId,
  summary,
) => {
  const result = await query(
    `UPDATE document_chats
     SET summary = $1, updated_at = NOW(), last_accessed_at = NOW()
     WHERE user_id = $2
       AND document_type = $3
       AND document_id = $4
       AND is_active = TRUE
     RETURNING *`,
    [
      summary,
      userId,
      normalizeType(documentType),
      String(documentId),
    ],
  );
  return mapRow(result.rows[0]);
};

const clear = async (
  userId,
  documentType,
  documentId,
  { ensureDb = connectDB, pool = null } = {},
) => {
  await ensureDb();
  const activePool = pool || getPool();
  const client = await activePool.connect();
  const params = [userId, normalizeType(documentType), String(documentId)];
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE document_chats
       SET messages = '[]'::jsonb,
           conversation_epoch = conversation_epoch + 1,
           last_message_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1
         AND document_type = $2
         AND document_id = $3
         AND is_active = TRUE
       RETURNING *`,
      params,
    );
    await client.query(CLEAR_CHAT_GENERATIONS_SQL, params);
    await client.query("COMMIT");
    return mapRow(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const setPinned = async (userId, documentType, documentId, isPinned) => {
  const result = await query(
    `UPDATE document_chats
     SET is_pinned = $1, updated_at = NOW()
     WHERE user_id = $2
       AND document_type = $3
       AND document_id = $4
       AND is_active = TRUE
     RETURNING *`,
    [
      Boolean(isPinned),
      userId,
      normalizeType(documentType),
      String(documentId),
    ],
  );
  return mapRow(result.rows[0]);
};

const getRecent = async (userId, limit = 20) => {
  const result = await query(
    `SELECT *
     FROM document_chats
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY is_pinned DESC,
       GREATEST(last_accessed_at, last_message_at, updated_at) DESC
     LIMIT $2`,
    [userId, Math.min(Math.max(Number(limit) || 20, 1), 100)],
  );
  return result.rows.map(mapRow);
};

const addNote = async (userId, documentType, documentId, body) => {
  const result = await query(
    `INSERT INTO research_notes (
       user_id, document_type, document_id, body
     )
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, normalizeType(documentType), String(documentId), body],
  );
  return result.rows[0];
};

const getNotes = async (userId, documentType, documentId) => {
  const result = await query(
    `SELECT id, body, is_pinned, created_at, updated_at
     FROM research_notes
     WHERE user_id = $1 AND document_type = $2 AND document_id = $3
     ORDER BY is_pinned DESC, updated_at DESC`,
    [userId, normalizeType(documentType), String(documentId)],
  );
  return result.rows;
};

const deleteNote = async (userId, noteId) => {
  const result = await query(
    `DELETE FROM research_notes
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [noteId, userId],
  );
  return Boolean(result.rows[0]);
};

const saveFeedback = async (
  userId,
  documentType,
  documentId,
  messageId,
  rating,
  reason = null,
) => {
  const result = await query(
    `INSERT INTO document_chat_feedback (
       user_id, document_type, document_id, message_id, rating, reason
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, document_type, document_id, message_id)
     DO UPDATE SET rating = EXCLUDED.rating,
       reason = EXCLUDED.reason,
       updated_at = NOW()
     RETURNING id, rating`,
    [
      userId,
      normalizeType(documentType),
      String(documentId),
      String(messageId),
      rating,
      reason,
    ],
  );
  return result.rows[0];
};

module.exports = {
  ALLOWED_DOCUMENT_TYPES,
  CLAIM_CHAT_GENERATION_AT_EPOCH_SQL,
  CLAIM_CHAT_GENERATION_SQL,
  CHAT_GENERATION_RETENTION,
  CHAT_STORAGE_LIMITS,
  CLEAR_CHAT_GENERATIONS_SQL,
  CLEANUP_CHAT_GENERATIONS_SQL,
  PRUNE_CHAT_GENERATIONS_SQL,
  UPSERT_CHAT_MESSAGE_SQL,
  addMessage,
  addNote,
  clear,
  deleteNote,
  findOne,
  findOrCreate,
  claimGeneration,
  cleanupGenerationClaims,
  completeGeneratedResponse,
  completeGeneration,
  failGeneration,
  getGeneration,
  getNotes,
  getRecent,
  normalizeType,
  saveFeedback,
  setPinned,
  updateSummary,
  validateChatMessageData,
};
