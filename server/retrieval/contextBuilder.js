const normalize = (value) => String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const nearDuplicate = (left, right) => {
  const a = new Set(normalize(left).split(" ").filter(Boolean));
  const b = new Set(normalize(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return false;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / Math.min(a.size, b.size) >= 0.88;
};

const selectContextPassages = (passages, options = {}) => {
  const maxChars = Math.max(2_000, Number(options.tokenBudget || 5_000) * 4);
  const perPassage = Math.max(500, Number(options.perPassageChars || 1_600));
  const selected = [];
  let used = 0;
  for (const passage of passages || []) {
    const content = String(passage.content || "").trim();
    if (!content || selected.some((item) => nearDuplicate(item.content, content))) continue;
    const available = maxChars - used;
    if (available < 200) break;
    const clipped = content.slice(0, Math.min(perPassage, available));
    selected.push({ ...passage, content: clipped });
    used += clipped.length;
  }
  return selected;
};

module.exports = { nearDuplicate, selectContextPassages };
