const jwt = require("jsonwebtoken");
require('dotenv').config();
const SecretKey = process.env.JWT_SECRET || "fallback-secret-change-me";

const fetchuser = (req, res, next) => {
  const token = req.header("auth-token") || req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const data = jwt.verify(token, SecretKey, {
      issuer: 'rashtram-ai',
      audience: 'rashtram-ai-client'
    });
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
