const jwt = require("jsonwebtoken");
const { isSessionActive } = require("../auth/sessionService");
require('dotenv').config();

const fetchuser = async (req, res, next) => {
  const token = req.header("auth-token") || req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is required");
    }

    const data = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'rashtram-ai',
      audience: 'rashtram-ai-client'
    });
    if (!(await isSessionActive(data.jti, data.user.id))) {
      return res.status(401).json({
        error: "This session has expired or was revoked.",
      });
    }
    req.user = data.user;
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired. Please log in again." });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: "Invalid token. Please log in again." });
    } else {
      return res.status(401).json({ error: "Token verification failed." });
    }
  }
};

module.exports = fetchuser;
