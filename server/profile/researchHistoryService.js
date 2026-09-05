const { query } = require("../db");

// Read-only composition of existing user-owned records. No new workspace schema.
async function getResearchHistory(userId, adapter = query) {
  const [chats, reports] = await Promise.all([
    adapter(`SELECT id, document_ids_json, comparison_id, updated_at,
        LEFT(messages->0->>'text', 160) AS title,
        messages->-1->'metadata'->'sourceIds' AS source_ids,
        messages->-1->'metadata'->'historySourceIds' AS history_source_ids,
        jsonb_array_length(messages) AS message_count
      FROM multi_document_chats WHERE user_id = $1
      AND jsonb_array_length(messages) > 0 ORDER BY updated_at DESC LIMIT 50`, [userId]),
    adapter(`SELECT id, title, selected_document_ids, verification_status, created_at
      FROM research_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]),
  ]);
  return {
    chats: chats.rows.map((row) => ({ id: String(row.id), title: row.title || "Research conversation",
      documentIds: (row.document_ids_json || []).map(String), sourceIds: row.source_ids || [],
      historySourceIds: row.history_source_ids || row.source_ids || [],
      comparisonId: row.comparison_id, updatedAt: row.updated_at, messageCount: row.message_count })),
    reports: reports.rows.map((row) => ({ id: String(row.id), title: row.title,
      documentIds: (row.selected_document_ids || []).map(String), status: row.verification_status, createdAt: row.created_at })),
  };
}

module.exports = { getResearchHistory };
