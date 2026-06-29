const crypto = require("crypto");
const { query } = require("../db");

const mapRow = (row) => {
  if (!row) return null;
  return new EGazetteChatRecord(row);
};

class EGazetteChatRecord {
  constructor(row) {
    this._id = String(row.id);
    this.gazetteId = row.gazette_id;
    this.userId = String(row.user_id);
    this.gazetteTitle = row.gazette_title;
    this.gazetteNumber = row.gazette_number;
    this.notificationType = row.notification_type;
    this.status = row.status;
    this.pdfUrl = row.pdf_url;
    this.sourceUrl = row.source_url;
    this.summary = row.summary;
    this.messages = row.messages || [];
    this.metadata = row.metadata_json || {};
    this.lastAccessedAt = row.last_accessed_at;
    this.lastMessageAt = row.last_message_at;
    this.isActive = row.is_active;
    this.createdAt = row.created_at;
    this.updatedAt = row.updated_at;
  }

  async addMessage(messageData) {
    const message = {
      _id: crypto.randomUUID(),
      text: String(messageData.text),
      sender: messageData.sender,
      timestamp: messageData.timestamp || new Date().toISOString(),
      sources: messageData.sources || [],
      isError: Boolean(messageData.isError),
    };
    const result = await query(
      `UPDATE egazette_chats
       SET messages = messages || $1::jsonb,
           last_message_at = NOW(),
           last_accessed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify([message]), this._id],
    );
    Object.assign(this, mapRow(result.rows[0]));
    return this;
  }

  async updateSummary(summary) {
    const result = await query(
      `UPDATE egazette_chats
       SET summary = $1,
           last_accessed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [summary, this._id],
    );
    Object.assign(this, mapRow(result.rows[0]));
    return this;
  }

  async clearChat() {
    const result = await query(
      `UPDATE egazette_chats
       SET messages = '[]'::jsonb,
           last_message_at = NOW(),
           last_accessed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [this._id],
    );
    Object.assign(this, mapRow(result.rows[0]));
    return this;
  }
}

const findOrCreate = async (userId, gazetteData) => {
  const result = await query(
    `INSERT INTO egazette_chats (
       user_id,
       gazette_id,
       gazette_title,
       gazette_number,
       notification_type,
       status,
       pdf_url,
       source_url,
       summary,
       metadata_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (user_id, gazette_id)
     DO UPDATE SET
       gazette_title = EXCLUDED.gazette_title,
       gazette_number = COALESCE(
         EXCLUDED.gazette_number,
         egazette_chats.gazette_number
       ),
       notification_type = COALESCE(
         EXCLUDED.notification_type,
         egazette_chats.notification_type
       ),
       status = COALESCE(EXCLUDED.status, egazette_chats.status),
       pdf_url = COALESCE(EXCLUDED.pdf_url, egazette_chats.pdf_url),
       source_url = COALESCE(EXCLUDED.source_url, egazette_chats.source_url),
       summary = COALESCE(EXCLUDED.summary, egazette_chats.summary),
       metadata_json =
         egazette_chats.metadata_json || EXCLUDED.metadata_json,
       is_active = TRUE,
       last_accessed_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      String(gazetteData.gazetteId),
      gazetteData.title,
      gazetteData.gazetteNumber || null,
      gazetteData.notificationType || null,
      gazetteData.status || null,
      gazetteData.pdfUrl || null,
      gazetteData.sourceUrl || null,
      gazetteData.summary || null,
      JSON.stringify(gazetteData.metadata || {}),
    ],
  );
  return mapRow(result.rows[0]);
};

const findOne = async ({ userId, gazetteId, isActive = true }) => {
  const result = await query(
    `SELECT *
     FROM egazette_chats
     WHERE user_id = $1 AND gazette_id = $2 AND is_active = $3
     LIMIT 1`,
    [userId, String(gazetteId), isActive],
  );
  return mapRow(result.rows[0]);
};

const getRecent = async (userId, limit = 10) => {
  const result = await query(
    `SELECT *
     FROM egazette_chats
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY GREATEST(last_accessed_at, last_message_at, updated_at) DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map(mapRow);
};

module.exports = {
  findOne,
  findOrCreate,
  getRecent,
};
