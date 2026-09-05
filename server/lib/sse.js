const crypto = require("node:crypto");

const startSSE = (res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
};

const sendSSE = (res, payload) => {
  if (res.writableEnded || res.destroyed) return false;
  return res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const completeSSE = (res, metadata = {}) => {
  sendSSE(res, { type: "done", ...metadata });
  if (!res.writableEnded && !res.destroyed) {
    res.write("data: [DONE]\n\n");
    res.end();
  }
};

const errorSSE = (res, error) => {
  const status = Number(error?.status || 500);
  const requestId = crypto.randomUUID();
  const isServerError = status >= 500;
  if (isServerError) {
    console.error(`SSE response failed [${requestId}]:`, error);
  }
  const payload = {
    type: "error",
    error: isServerError
      ? error?.publicMessage || "Response generation failed. Please try again."
      : error?.message || "Response generation failed.",
    requestId,
    ...(error?.publicCode || error?.failureCode
      ? { code: error.publicCode || error.failureCode }
      : {}),
  };
  sendSSE(res, payload);
  if (!res.writableEnded && !res.destroyed) res.end();
};

module.exports = {
  completeSSE,
  errorSSE,
  sendSSE,
  startSSE,
};
