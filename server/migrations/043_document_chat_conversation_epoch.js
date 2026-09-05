const crypto = require("node:crypto");

const sql = `
ALTER TABLE document_chats
  ADD COLUMN IF NOT EXISTS conversation_epoch BIGINT NOT NULL DEFAULT 0;

ALTER TABLE document_chats
  DROP CONSTRAINT IF EXISTS document_chats_conversation_epoch_nonnegative;

ALTER TABLE document_chats
  ADD CONSTRAINT document_chats_conversation_epoch_nonnegative
  CHECK (conversation_epoch >= 0);

ALTER TABLE document_chat_generations
  ADD COLUMN IF NOT EXISTS conversation_epoch BIGINT NOT NULL DEFAULT 0;

ALTER TABLE document_chat_generations
  DROP CONSTRAINT IF EXISTS document_chat_generations_conversation_epoch_nonnegative;

ALTER TABLE document_chat_generations
  ADD CONSTRAINT document_chat_generations_conversation_epoch_nonnegative
  CHECK (conversation_epoch >= 0);

CREATE INDEX IF NOT EXISTS document_chat_generations_stale_processing_idx
  ON document_chat_generations (updated_at ASC)
  WHERE status = 'processing';
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
