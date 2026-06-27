const crypto = require("crypto");
const { query } = require("../db");

const mapRow = (row) => {
  if (!row) return null;
  return new ActChatRecord(row);
};

class ActChatRecord {
  constructor(row) {
    this._id = String(row.id);
    this.actId = row.act_id;
    this.userId = String(row.user_id);
    this.actTitle = row.act_title;
    this.actStatus = row.act_status;
    this.pdfUrl = row.pdf_url;
    this.summary = row.summary;
    this.messages = row.messages || [];
    this.isActive = row.is_active;
    this.createdAt = row.created_at;
    this.updatedAt = row.updated_at;
  }

  async addMessage(messageData) {
    const message = {
      _id: crypto.randomUUID(),
      text: messageData.text,
      sender: messageData.sender,
      timestamp:
        messageData.timestamp ||
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      sources: messageData.sources || [],
      isError: messageData.isError || false,
    };

    const result = await query(
      `UPDATE act_chats
          SET messages = messages || $1::jsonb,
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
      `UPDATE act_chats
          SET summary = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *`,
      [summary, this._id],
    );
    Object.assign(this, mapRow(result.rows[0]));
    return this;
  }

  async clearChat() {
    const result = await query(
      `UPDATE act_chats
          SET messages = '[]'::jsonb, updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [this._id],
    );
    Object.assign(this, mapRow(result.rows[0]));
    return this;
  }

  async deactivate() {
    const result = await query(
      `UPDATE act_chats
          SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [this._id],
    );
    Object.assign(this, mapRow(result.rows[0]));
    return this;
  }

  toJSON() {
    return { ...this };
  }
}

const findOrCreate = async (userId, actData) => {
  const result = await query(
    `INSERT INTO act_chats (
       user_id, act_id, act_title, act_status, pdf_url, summary
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, act_id)
     DO UPDATE SET
       act_title = EXCLUDED.act_title,
       act_status = COALESCE(EXCLUDED.act_status, act_chats.act_status),
       pdf_url = COALESCE(EXCLUDED.pdf_url, act_chats.pdf_url),
       summary = COALESCE(EXCLUDED.summary, act_chats.summary),
       is_active = TRUE,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      String(actData.actId),
      actData.title,
      actData.status || null,
      actData.pdfUrl || null,
      actData.summary || null,
    ],
  );
  return mapRow(result.rows[0]);
};

const getChatByAct = async (userId, actId) => {
  const result = await query(
    `SELECT * FROM act_chats
      WHERE user_id = $1 AND act_id = $2 AND is_active = TRUE
      LIMIT 1`,
    [userId, String(actId)],
  );
  return mapRow(result.rows[0]);
};

const findOne = async ({ userId, actId, isActive = true }) => {
  const result = await query(
    `SELECT * FROM act_chats
      WHERE user_id = $1 AND act_id = $2 AND is_active = $3
      LIMIT 1`,
    [userId, String(actId), isActive],
  );
  return mapRow(result.rows[0]);
};

const getUserRecentChats = async (userId, limit = 10) => {
  const result = await query(
    `SELECT * FROM act_chats
      WHERE user_id = $1 AND is_active = TRUE
      ORDER BY updated_at DESC
      LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map((row) => mapRow(row));
};

const countDocuments = async ({ userId, isActive = true }) => {
  const result = await query(
    `SELECT COUNT(*)::int AS count
       FROM act_chats
      WHERE user_id = $1 AND is_active = $2`,
    [userId, isActive],
  );
  return result.rows[0].count;
};

module.exports = {
  countDocuments,
  findOne,
  findOrCreate,
  getChatByAct,
  getUserRecentChats,
};
