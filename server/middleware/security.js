const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const helmet = require('helmet');


const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,

  skipSuccessfulRequests: true
});


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,

  skipSuccessfulRequests: false
});

const activityLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 240,
  message: {
    error: "Activity tracking rate limit reached. Research remains available.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Dedicated budget for expensive AI-calling routes (chat, comparison, prepare,
// OCR). Separate from generalLimiter so cheap browsing never competes with a
// single client exhausting LLM budget. Keyed by authenticated user when
// available so one account can't dodge the limit by rotating networks, and
// falls back to IP for unauthenticated callers.
const generationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    error: "Too many AI requests. Please slow down and try again shortly.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip),
});


const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"],
    },
  },
  crossOriginEmbedderPolicy: false,

  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xPoweredBy: false
});

module.exports = {
  activityLimiter,
  generalLimiter,
  authLimiter,
  generationLimiter,
  helmetConfig
};
