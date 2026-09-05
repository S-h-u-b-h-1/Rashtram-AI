const normalizeSourceIds = (values) => [...new Set(
  (Array.isArray(values) ? values : String(values || "").split(","))
    .map((value) => String(value).trim()).filter((value) => /^\d+$/.test(value)),
)].slice(0, 20);

// Keep all existing catalogue selection keys byte-for-byte compatible.
const researchSelectionKey = (documentIds, historySourceIds = []) => {
  const sort = (ids) => [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(":");
  return documentIds.length ? sort(documentIds) : `sources:${sort(normalizeSourceIds(historySourceIds))}`;
};
module.exports = { normalizeSourceIds, researchSelectionKey };
