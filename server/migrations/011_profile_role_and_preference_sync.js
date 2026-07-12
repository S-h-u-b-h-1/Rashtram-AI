const crypto = require("crypto");

const sql = `
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT;

CREATE INDEX IF NOT EXISTS user_profiles_onboarding_idx
  ON user_profiles (onboarding_completed, onboarding_skipped, updated_at DESC);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
