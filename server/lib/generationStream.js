const streamChunkText = (chunk) => {
  if (typeof chunk === "string") return chunk;
  if (typeof chunk?.text === "function") return String(chunk.text() || "");
  if (typeof chunk?.text === "string") return chunk.text;
  if (typeof chunk?.delta === "string") return chunk.delta;
  return "";
};

module.exports = { streamChunkText };
