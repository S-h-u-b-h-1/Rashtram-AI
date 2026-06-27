const { normalizeTitle } = require("./normalizer");

const tokens = (value) =>
  new Set(
    normalizeTitle(value)
      .split(" ")
      .filter((token) => token.length > 1),
  );

const titleSimilarity = (left, right) => {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return (2 * intersection) / (leftTokens.size + rightTokens.size);
};

const normalizedIdentifier = (value) =>
  value ? String(value).trim().toLowerCase() : null;

const evaluateCandidate = (record, candidate) => {
  if (
    record.sourceName === candidate.source_name &&
    record.sourceRecordId === candidate.source_record_id
  ) {
    return { action: "merge", reason: "exact-source", similarity: 1 };
  }

  const sameJurisdiction =
    record.jurisdiction &&
    candidate.jurisdiction &&
    String(record.jurisdiction).toLowerCase() ===
      String(candidate.jurisdiction).toLowerCase();
  const sameYear =
    record.year &&
    candidate.year &&
    Number(record.year) === Number(candidate.year);
  const sameDocumentType =
    record.documentType &&
    candidate.document_type &&
    record.documentType === candidate.document_type;
  const gazetteMatch =
    normalizedIdentifier(record.gazetteIdentifier) &&
    normalizedIdentifier(record.gazetteIdentifier) ===
      normalizedIdentifier(candidate.gazette_identifier);
  const legalIdentifierMatch =
    sameJurisdiction &&
    normalizedIdentifier(record.legalIdentifier) &&
    normalizedIdentifier(record.legalIdentifier) ===
      normalizedIdentifier(candidate.legal_identifier);
  const scopedNumberMatch =
    sameJurisdiction &&
    sameYear &&
    sameDocumentType &&
    ((normalizedIdentifier(record.actNumber) &&
      normalizedIdentifier(record.actNumber) ===
        normalizedIdentifier(candidate.act_number)) ||
      (normalizedIdentifier(record.billNumber) &&
        normalizedIdentifier(record.billNumber) ===
          normalizedIdentifier(candidate.bill_number)));
  if (gazetteMatch || legalIdentifierMatch || scopedNumberMatch) {
    return { action: "merge", reason: "legal-identifier", similarity: 1 };
  }

  if (record.contentHash && record.contentHash === candidate.content_hash) {
    return { action: "merge", reason: "content-hash", similarity: 1 };
  }

  if (
    record.textFingerprint &&
    record.textFingerprint === candidate.text_fingerprint
  ) {
    return { action: "merge", reason: "text-fingerprint", similarity: 1 };
  }

  const similarity = sameYear && sameJurisdiction && sameDocumentType
    ? titleSimilarity(record.normalizedTitle, candidate.normalized_title)
    : 0;

  if (similarity >= 0.92) {
    return { action: "merge", reason: "high-title-similarity", similarity };
  }
  if (similarity >= 0.8) {
    return { action: "review", reason: "possible-title-match", similarity };
  }
  return { action: "create", reason: "no-match", similarity };
};

const chooseBestCandidate = (record, candidates) => {
  const evaluations = candidates
    .map((candidate) => ({
      candidate,
      ...evaluateCandidate(record, candidate),
    }))
    .sort((left, right) => {
      const actionRank = { merge: 3, review: 2, create: 1 };
      return (
        actionRank[right.action] - actionRank[left.action] ||
        right.similarity - left.similarity
      );
    });
  return (
    evaluations[0] || {
      action: "create",
      reason: "no-candidates",
      similarity: 0,
      candidate: null,
    }
  );
};

module.exports = {
  chooseBestCandidate,
  evaluateCandidate,
  titleSimilarity,
};
