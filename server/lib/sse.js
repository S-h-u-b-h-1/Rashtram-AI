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
  sendSSE(res, {
    type: "error",
    error: error?.message || "Response generation failed.",
  });
  if (!res.writableEnded && !res.destroyed) res.end();
};

module.exports = {
  completeSSE,
  errorSSE,
  sendSSE,
  startSSE,
};
