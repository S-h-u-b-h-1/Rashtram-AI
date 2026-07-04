const crypto = require("crypto");
const { query } = require("../db");

const mapRow = (row) => {
  if (!row) return null;
  return new PolicyChatRecord(row);
};

class PolicyChatRecord {
  constructor(row) {
    this._id = String(row.id);
    this.policyId = row.policy_id;
    this.userId = String(row.user_id);
    this.policyTitle = row.policy_title;
    this.category = row.category;
    this.status = row.status;
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
      `UPDATE policy_chats
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
      `UPDATE policy_chats
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
      `UPDATE policy_chats
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

const findOrCreate = async (userId, policyData) => {
  const result = await query(
    `INSERT INTO policy_chats (
       user_id,
       policy_id,
       policy_title,
       category,
       status,
       source_url,
       summary,
       metadata_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (user_id, policy_id)
     DO UPDATE SET
       policy_title = EXCLUDED.policy_title,
       category = COALESCE(EXCLUDED.category, policy_chats.category),
       status = COALESCE(EXCLUDED.status, policy_chats.status),
       source_url = COALESCE(EXCLUDED.source_url, policy_chats.source_url),
       summary = COALESCE(EXCLUDED.summary, policy_chats.summary),
       metadata_json =
         policy_chats.metadata_json || EXCLUDED.metadata_json,
       is_active = TRUE,
       last_accessed_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      String(policyData.policyId),
      policyData.title,
      policyData.category || null,
      policyData.status || null,
      policyData.sourceUrl || null,
      policyData.summary || null,
      JSON.stringify(policyData.metadata || {}),
    ],
  );
  return mapRow(result.rows[0]);
};

const findOne = async ({ userId, policyId, isActive = true }) => {
  const result = await query(
    `SELECT *
     FROM policy_chats
     WHERE user_id = $1 AND policy_id = $2 AND is_active = $3
     LIMIT 1`,
    [userId, String(policyId), isActive],
  );
  return mapRow(result.rows[0]);
};

const getRecent = async (userId, limit = 10) => {
  const result = await query(
    `SELECT *
     FROM policy_chats
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
