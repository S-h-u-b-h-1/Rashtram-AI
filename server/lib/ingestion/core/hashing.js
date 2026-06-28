const crypto = require("crypto");

const sha256 = (value) =>
  crypto.createHash("sha256").update(value || "").digest("hex");

const sha256Buffer = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const computeSha256 = (value) =>
  Buffer.isBuffer(value) ? sha256Buffer(value) : sha256(value);

const generateSourceStableId = (...parts) =>
  sha256(
    parts
      .flat()
      .filter((part) => part != null && String(part).trim())
      .map((part) => String(part).trim())
      .join("\u001f"),
  ).slice(0, 32);

const normalizeFingerprintText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .split(/\r?\n/)
    .filter((line) => {
      const normalized = line.trim();
      return (
        normalized &&
        !/^(?:page\s*)?\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(normalized)
      );
    })
    .join(" ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const textFingerprint = (value) => {
  const normalized = normalizeFingerprintText(value);
  return normalized ? sha256(normalized) : null;
};

const stableRecordHash = (value) => {
  const normalize = (input) => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.keys(input)
          .sort()
          .map((key) => [key, normalize(input[key])]),
      );
    }
    return input;
  };

  return sha256(JSON.stringify(normalize(value)));
};

module.exports = {
  computeSha256,
  generateSourceStableId,
  normalizeFingerprintText,
  sha256,
  sha256Buffer,
  stableRecordHash,
  textFingerprint,
};
