const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { query } = require("../db");

const getSecretKey = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  return process.env.JWT_SECRET;
};

const createSessionToken = async (userId, req) => {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  const token = jwt.sign(
    { user: { id: String(userId) } },
    getSecretKey(),
    {
      expiresIn: "24h",
      issuer: "rashtram-ai",
      audience: "rashtram-ai-client",
      jwtid: sessionId,
    },
  );
  await query(
    `INSERT INTO user_sessions (
       id, user_id, user_agent, ip_address, expires_at
     )
     VALUES ($1, $2, $3, $4, $5)`,
    [
      sessionId,
      userId,
      String(req.get("user-agent") || "").slice(0, 500) || null,
      null,
      expiresAt,
    ],
  );
  return token;
};

const isSessionActive = async (sessionId, userId) => {
  if (!sessionId) return true;
  const result = await query(
    `WITH active AS MATERIALIZED (
       SELECT id
       FROM user_sessions
       WHERE id = $1
         AND user_id = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()
     ),
     touched AS (
       UPDATE user_sessions session
       SET last_seen_at = NOW()
       FROM active
       WHERE session.id = active.id
         AND session.last_seen_at < NOW() - INTERVAL '5 minutes'
       RETURNING session.id
     )
     SELECT id FROM active`,
    [sessionId, userId],
  );
  return Boolean(result.rows[0]);
};

module.exports = {
  createSessionToken,
  isSessionActive,
};
