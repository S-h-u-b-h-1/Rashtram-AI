const crypto = require("crypto");

const sha256 = (value) =>
  crypto.createHash("sha256").update(value || "").digest("hex");

const sha256Buffer = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const normalizeFingerprintText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
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
  normalizeFingerprintText,
  sha256,
  sha256Buffer,
  stableRecordHash,
  textFingerprint,
};
