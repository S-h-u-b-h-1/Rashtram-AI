const safeJsonParse = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
};

const safeArray = (value, fallback = []) => {
  const parsed = safeJsonParse(value, value);
  return Array.isArray(parsed) ? parsed : fallback;
};

const safeObject = (value, fallback = {}) => {
  const parsed = safeJsonParse(value, value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed
    : fallback;
};

const safeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeNullableString = (value) => {
  if (value == null) return null;
  const normalized = String(value).normalize("NFKC").trim();
  return normalized || null;
};

const safeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  normalizeNullableString,
  safeArray,
  safeDate,
  safeInteger,
  safeJsonParse,
  safeNumber,
  safeObject,
};
