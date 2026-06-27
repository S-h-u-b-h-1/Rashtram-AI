const crypto = require("crypto");
const { query } = require("../db");

const mapRow = (row) => {
  if (!row) return null;
  return new BillChatRecord(row);
};

class BillChatRecord {
  constructor(row) {
    this._id = String(row.id);
    this.billId = row.bill_id;
    this.userId = String(row.user_id);
    this.billTitle = row.bill_title;
    this.billStatus = row.bill_status;
    this.pdfUrl = row.pdf_url;
    this.summary = row.summary;
    this.messages = row.messages || [];
    this.lastMessageAt = row.last_message_at;
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
      `UPDATE bill_chats
          SET messages = messages || $1::jsonb,
              last_message_at = NOW(),
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
      `UPDATE bill_chats
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
      `UPDATE bill_chats
          SET messages = '[]'::jsonb,
              last_message_at = NOW(),
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [this._id],
    );
    Object.assign(this, mapRow(result.rows[0]));
    return this;
  }

  async deactivate() {
    const result = await query(
      `UPDATE bill_chats
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

const findOrCreate = async (userId, billData) => {
  const result = await query(
    `INSERT INTO bill_chats (
       user_id, bill_id, bill_title, bill_status, pdf_url, summary
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, bill_id)
     DO UPDATE SET
       bill_title = EXCLUDED.bill_title,
       bill_status = COALESCE(EXCLUDED.bill_status, bill_chats.bill_status),
       pdf_url = COALESCE(EXCLUDED.pdf_url, bill_chats.pdf_url),
       summary = COALESCE(EXCLUDED.summary, bill_chats.summary),
       is_active = TRUE,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      String(billData.billId),
      billData.title,
      billData.status || null,
      billData.pdfUrl || null,
      billData.summary || null,
    ],
  );
  return mapRow(result.rows[0]);
};

const getChatByBill = async (userId, billId) => {
  const result = await query(
    `SELECT * FROM bill_chats
      WHERE user_id = $1 AND bill_id = $2 AND is_active = TRUE
      LIMIT 1`,
    [userId, String(billId)],
  );
  return mapRow(result.rows[0]);
};

const findOne = async ({ userId, billId, isActive = true }) => {
  const result = await query(
    `SELECT * FROM bill_chats
      WHERE user_id = $1 AND bill_id = $2 AND is_active = $3
      LIMIT 1`,
    [userId, String(billId), isActive],
  );
  return mapRow(result.rows[0]);
};

const getUserRecentChats = async (userId, limit = 10) => {
  const result = await query(
    `SELECT * FROM bill_chats
      WHERE user_id = $1 AND is_active = TRUE
      ORDER BY last_message_at DESC
      LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map((row) => mapRow(row));
};

const countDocuments = async ({ userId, isActive = true }) => {
  const result = await query(
    `SELECT COUNT(*)::int AS count
       FROM bill_chats
      WHERE user_id = $1 AND is_active = $2`,
    [userId, isActive],
  );
  return result.rows[0].count;
};

module.exports = {
  countDocuments,
  findOne,
  findOrCreate,
  getChatByBill,
  getUserRecentChats,
};
