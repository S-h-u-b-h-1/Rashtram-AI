const CANONICAL_FIELDS = [
  "title",
  "normalizedTitle",
  "documentType",
  "jurisdictionLevel",
  "jurisdiction",
  "year",
  "status",
  "authority",
  "ministry",
  "department",
  "category",
  "legalIdentifier",
  "billNumber",
  "actNumber",
  "gazetteIdentifier",
  "introducedDate",
  "passedDate",
  "enactedDate",
  "publicationDate",
  "effectiveDate",
  "pdfUrl",
  "contentHash",
  "textFingerprint",
];

const mergeCanonical = (current, incoming) => {
  const currentPriority = Number(current.sourcePriority || 100);
  const incomingPriority = Number(incoming.sourcePriority || 100);
  const incomingWins = incomingPriority < currentPriority;
  const merged = { ...current };

  for (const field of CANONICAL_FIELDS) {
    if (incoming[field] != null && (incomingWins || current[field] == null)) {
      merged[field] = incoming[field];
    }
  }

  if (incomingWins) {
    merged.canonicalSource = incoming.sourceName;
    merged.canonicalUrl =
      incoming.detailUrl || incoming.sourceUrl || incoming.pdfUrl;
    merged.sourcePriority = incomingPriority;
  }

  merged.metadata = {
    ...(current.metadata || {}),
    ...(incoming.metadata || incoming.sourceMetadata || {}),
  };
  return merged;
};

module.exports = {
  CANONICAL_FIELDS,
  mergeCanonical,
};
