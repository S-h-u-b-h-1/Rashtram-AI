const crypto = require("crypto");
const { query } = require("../db");

const {
  DOCUMENT_TYPES,
  normalizeDocumentType,
} = require("../document/documentTypes");

const ALLOWED_DOCUMENT_TYPES = DOCUMENT_TYPES;

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

const addMessage = async (
  userId,
  documentType,
  documentId,
  messageData,
) => {
  const message = {
    _id: messageData._id || crypto.randomUUID(),
    text: String(messageData.text),
    sender: messageData.sender,
    timestamp: messageData.timestamp || new Date().toISOString(),
    sources: Array.isArray(messageData.sources) ? messageData.sources : [],
    isError: Boolean(messageData.isError),
  };
  const result = await query(
    `UPDATE document_chats
     SET messages = messages || $1::jsonb,
         last_message_at = NOW(),
         last_accessed_at = NOW(),
         updated_at = NOW()
     WHERE user_id = $2
       AND document_type = $3
       AND document_id = $4
       AND is_active = TRUE
     RETURNING *`,
    [
      JSON.stringify([message]),
      userId,
      normalizeType(documentType),
      String(documentId),
    ],
  );
  return mapRow(result.rows[0]);
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

const clear = async (userId, documentType, documentId) => {
  const result = await query(
    `UPDATE document_chats
     SET messages = '[]'::jsonb,
         last_message_at = NOW(),
         updated_at = NOW()
     WHERE user_id = $1
       AND document_type = $2
       AND document_id = $3
       AND is_active = TRUE
     RETURNING *`,
    [userId, normalizeType(documentType), String(documentId)],
  );
  return mapRow(result.rows[0]);
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
  addMessage,
  addNote,
  clear,
  deleteNote,
  findOne,
  findOrCreate,
  getNotes,
  getRecent,
  normalizeType,
  saveFeedback,
  setPinned,
  updateSummary,
};
