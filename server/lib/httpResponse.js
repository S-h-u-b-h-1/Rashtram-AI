const crypto = require("node:crypto");

// One shared error-response shape for all routes: client errors (4xx) pass
// the real message through since it's meant to be shown, server errors
// (5xx) are logged with a request ID but never echo the raw error message
// back to the client (it can carry internal details — DB errors, provider
// errors, stack fragments). Previously duplicated with drifted behavior
// across documentsRoute.js, documentChatRoute.js, graph/route.js, and
// recommendationsRoute.js — some of those variants leaked raw 5xx messages.
const sendError = (res, error, context) => {
  const status = error.status || 500;
  if (status >= 500) {
    const requestId = crypto.randomUUID();
    console.error(`${context} [${requestId}]:`, error);
    return res.status(status).json({
      error: error.publicMessage || "Internal server error.",
      ...(error.publicCode ? { code: error.publicCode } : {}),
      requestId,
    });
  }
  return res.status(status).json({
    error: error.message,
    ...(error.failureCode ? { code: error.failureCode } : {}),
    ...(error.details ? { details: error.details } : {}),
  });
};

module.exports = { sendError };
