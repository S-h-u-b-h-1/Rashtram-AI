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
    `SELECT id, last_seen_at
     FROM user_sessions
     WHERE id = $1
       AND user_id = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [sessionId, userId],
  );
  const session = result.rows[0];
  if (!session) return false;

  if (
    Date.now() - new Date(session.last_seen_at).getTime() >
    5 * 60 * 1_000
  ) {
    await query(
      `UPDATE user_sessions
       SET last_seen_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND last_seen_at < NOW() - INTERVAL '5 minutes'`,
      [sessionId, userId],
    ).catch((error) => {
      console.warn("Session activity timestamp update skipped:", error.message);
    });
  }
  return true;
};

module.exports = {
  createSessionToken,
  isSessionActive,
};
