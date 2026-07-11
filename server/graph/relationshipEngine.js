const { query } = require("../db");
const {
  providerConfig,
  verifyDocumentRelationship,
} = require("../lib/vectordb");

const RELATIONSHIP_TYPES = new Set([
  "AMENDS",
  "AMENDED_BY",
  "REPEALS",
  "REPEALED_BY",
  "IMPLEMENTS",
  "IMPLEMENTED_BY",
  "RELATED_TO",
  "SUPERSEDES",
  "SUPERSEDED_BY",
  "REFERS_TO",
  "REFERRED_BY",
  "ISSUED_BY",
  "ISSUES",
  "REPLACES",
  "REPLACED_BY",
  "EXPLAINS",
  "EXPLAINED_BY",
  "CONSULTS",
  "CONSULTED_BY",
  "NOTIFIES",
  "NOTIFIED_BY",
  "GOVERNED_BY",
  "SIMILAR_TO",
  "STATE_EQUIVALENT",
  "CENTRAL_EQUIVALENT",
  "PARENT_POLICY",
  "CHILD_POLICY",
  "REGULATED_BY",
  "COMPLIANCE_REQUIRED",
  "RULE_OF",
  "UNDER_ACT",
  "UNDER_BILL",
  "UNDER_POLICY",
  "UNDER_NOTIFICATION",
  "BECAME_ACT",
  "ENACTED_FROM",
]);

const INVERSE_RELATIONSHIPS = {
  AMENDS: "AMENDED_BY",
  AMENDED_BY: "AMENDS",
  REPEALS: "REPEALED_BY",
  REPEALED_BY: "REPEALS",
  IMPLEMENTS: "IMPLEMENTED_BY",
  IMPLEMENTED_BY: "IMPLEMENTS",
  RELATED_TO: "RELATED_TO",
  SUPERSEDES: "SUPERSEDED_BY",
  SUPERSEDED_BY: "SUPERSEDES",
  REFERS_TO: "REFERRED_BY",
  REFERRED_BY: "REFERS_TO",
  REPLACES: "REPLACED_BY",
  REPLACED_BY: "REPLACES",
  EXPLAINS: "EXPLAINED_BY",
  EXPLAINED_BY: "EXPLAINS",
  CONSULTS: "CONSULTED_BY",
  CONSULTED_BY: "CONSULTS",
  NOTIFIES: "NOTIFIED_BY",
  NOTIFIED_BY: "NOTIFIES",
  SIMILAR_TO: "SIMILAR_TO",
  STATE_EQUIVALENT: "STATE_EQUIVALENT",
  CENTRAL_EQUIVALENT: "STATE_EQUIVALENT",
  PARENT_POLICY: "CHILD_POLICY",
  CHILD_POLICY: "PARENT_POLICY",
  BECAME_ACT: "ENACTED_FROM",
  ENACTED_FROM: "BECAME_ACT",
};

const GENERIC_TITLE_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "for",
  "to",
  "in",
  "india",
  "indian",
  "bill",
  "act",
  "rules",
  "rule",
  "policy",
  "notification",
  "gazette",
  "amendment",
  "amending",
  "regulation",
  "regulations",
  "order",
  "circular",
  "report",
]);

const normalizedTokens = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token && !GENERIC_TITLE_WORDS.has(token));

const titleSimilarity = (left, right) => {
  const leftTokens = new Set(normalizedTokens(left));
  const rightTokens = new Set(normalizedTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / (leftTokens.size + rightTokens.size - shared);
};

const textReferencesDocument = (text, document) => {
  const haystack = String(text || "").toLowerCase();
  const legalIdentifier = String(document.legal_identifier || "").toLowerCase();
  if (legalIdentifier.length >= 5 && haystack.includes(legalIdentifier)) {
    return { matched: true, signal: "legal_identifier", value: legalIdentifier };
  }
  const meaningfulTitle = normalizedTokens(document.title).join(" ");
  if (meaningfulTitle.length >= 12) {
    const titleTokens = meaningfulTitle.split(" ");
    const matched = titleTokens.filter((token) => haystack.includes(token));
    if (matched.length >= Math.min(4, Math.ceil(titleTokens.length * 0.7))) {
      return {
        matched: true,
        signal: "title_reference",
        value: matched.slice(0, 8).join(" "),
      };
    }
  }
  return { matched: false };
};

const inferRelationship = (source, target) => {
  const sourceText = [
    source.metadata_json && JSON.stringify(source.metadata_json),
    source.original_text,
  ].filter(Boolean).join("\n");
  const reference = textReferencesDocument(sourceText, target);
  const similarity = titleSimilarity(source.title, target.title);
  const sourceType = source.document_type;
  const targetType = target.document_type;
  const amendment = /amend(?:ment|ing|s|ed)?/i.test(source.title || "");
  const repeal = /repeal(?:s|ed|ing)?/i.test(sourceText);
  const replace = /replac(?:es|ed|ing)|supersed(?:es|ed|ing)/i.test(sourceText);
  const explanation = (summary) =>
    `${summary} Evidence was derived from catalogue metadata and indexed source text.`;

  if (
    sourceType === "bill" &&
    targetType === "act" &&
    similarity >= 0.7 &&
    (!source.year || !target.year || Math.abs(source.year - target.year) <= 2)
  ) {
    return {
      type: "BECAME_ACT",
      confidence: Math.min(0.98, 0.78 + similarity * 0.2),
      strength: 0.95,
      explanation: explanation(
        `${source.title} and ${target.title} share a high-confidence legislative title lineage.`,
      ),
      evidence: { signal: "bill_act_title_lineage", titleSimilarity: similarity },
    };
  }
  if (amendment && reference.matched && targetType === "act") {
    return {
      type: "AMENDS",
      confidence: 0.94,
      strength: 0.96,
      explanation: explanation(
        `${source.title} explicitly identifies ${target.title} as the amended instrument.`,
      ),
      evidence: { ...reference, titleSimilarity: similarity },
    };
  }
  if (repeal && reference.matched) {
    return {
      type: "REPEALS",
      confidence: 0.9,
      strength: 0.94,
      explanation: explanation(
        `${source.title} contains a repeal reference to ${target.title}.`,
      ),
      evidence: { ...reference, titleSimilarity: similarity },
    };
  }
  if (replace && reference.matched) {
    return {
      type: /supersed/i.test(sourceText) ? "SUPERSEDES" : "REPLACES",
      confidence: 0.88,
      strength: 0.9,
      explanation: explanation(
        `${source.title} contains a replacement or supersession reference to ${target.title}.`,
      ),
      evidence: { ...reference, titleSimilarity: similarity },
    };
  }
  if (
    ["rule", "regulation"].includes(sourceType) &&
    targetType === "act" &&
    reference.matched
  ) {
    return {
      type: "RULE_OF",
      confidence: 0.92,
      strength: 0.93,
      explanation: explanation(
        `${source.title} identifies ${target.title} as its enabling Act.`,
      ),
      evidence: { ...reference, titleSimilarity: similarity },
    };
  }
  if (
    ["notification", "gazette", "order", "circular"].includes(sourceType) &&
    targetType === "act" &&
    reference.matched
  ) {
    return {
      type: /under\s+(?:section|the provisions|the powers)/i.test(sourceText)
        ? "UNDER_ACT"
        : sourceType === "circular"
          ? "EXPLAINS"
          : "NOTIFIES",
      confidence: 0.86,
      strength: 0.88,
      explanation: explanation(
        `${source.title} explicitly cross-references ${target.title}.`,
      ),
      evidence: { ...reference, titleSimilarity: similarity },
    };
  }
  if (reference.matched) {
    return {
      type: "REFERS_TO",
      confidence: 0.78,
      strength: 0.72,
      explanation: explanation(
        `${source.title} contains an explicit reference to ${target.title}.`,
      ),
      evidence: { ...reference, titleSimilarity: similarity },
    };
  }
  const differentStates =
    source.state &&
    target.state &&
    source.state !== target.state;
  if (differentStates && similarity >= 0.72) {
    return {
      type: "STATE_EQUIVALENT",
      confidence: Math.min(0.9, 0.62 + similarity * 0.3),
      strength: similarity,
      explanation: explanation(
        `${source.title} and ${target.title} have closely matching subjects in different state jurisdictions.`,
      ),
      evidence: {
        signal: "cross_state_title_similarity",
        titleSimilarity: similarity,
        sourceState: source.state,
        targetState: target.state,
      },
    };
  }
  if (
    similarity >= 0.62 &&
    source.document_type === target.document_type
  ) {
    return {
      type: "SIMILAR_TO",
      confidence: Math.min(0.82, 0.5 + similarity * 0.35),
      strength: similarity,
      explanation: explanation(
        `${source.title} and ${target.title} share strongly overlapping normalized titles.`,
      ),
      evidence: { signal: "title_similarity", titleSimilarity: similarity },
    };
  }
  if (
    source.ministry &&
    source.ministry === target.ministry &&
    source.category &&
    source.category === target.category &&
    similarity >= 0.32
  ) {
    return {
      type: "RELATED_TO",
      confidence: Math.min(0.74, 0.48 + similarity * 0.3),
      strength: Math.min(0.8, 0.45 + similarity * 0.4),
      explanation: explanation(
        `${source.title} and ${target.title} share ministry, category, and subject signals.`,
      ),
      evidence: {
        signal: "shared_ministry_category",
        ministry: source.ministry,
        category: source.category,
        titleSimilarity: similarity,
      },
    };
  }
  return null;
};

const loadDocument = async (documentId) => {
  const result = await query(
    `SELECT legacy.*, schema_document.state,
       schema_document.normalized_title,
       schema_document.quality_score,
       schema_document.visibility_status,
       artifact.original_text
     FROM legislative_documents legacy
     JOIN documents schema_document ON schema_document.id = legacy.id
     LEFT JOIN document_text_artifacts artifact
       ON artifact.document_id = legacy.id
     WHERE legacy.id = $1
       AND schema_document.visibility_status = 'public'
     LIMIT 1`,
    [documentId],
  );
  return result.rows[0] || null;
};

const loadCandidates = async (source, limit = 100) => {
  const tokens = normalizedTokens(source.title).slice(0, 6);
  const result = await query(
    `SELECT legacy.*, schema_document.state,
       schema_document.normalized_title,
       schema_document.quality_score,
       schema_document.visibility_status
     FROM legislative_documents legacy
     JOIN documents schema_document ON schema_document.id = legacy.id
     WHERE legacy.id <> $1
       AND schema_document.visibility_status = 'public'
       AND schema_document.quality_score >= 35
       AND (
         (
           $2::TEXT IS NOT NULL
           AND legacy.legal_identifier = $2
         )
         OR (
           $3::TEXT IS NOT NULL
           AND legacy.ministry = $3
         )
         OR (
           $4::TEXT IS NOT NULL
           AND legacy.category = $4
         )
         OR (
           CARDINALITY($5::TEXT[]) > 0
           AND EXISTS (
             SELECT 1 FROM UNNEST($5::TEXT[]) token
             WHERE legacy.title ILIKE '%' || token || '%'
           )
         )
       )
     ORDER BY
       CASE WHEN legacy.legal_identifier = $2 THEN 0 ELSE 1 END,
       schema_document.quality_score DESC,
       legacy.updated_at DESC
     LIMIT $6`,
    [
      source.id,
      source.legal_identifier,
      source.ministry,
      source.category,
      tokens,
      limit,
    ],
  );
  return result.rows;
};

const upsertRelationship = async (
  sourceId,
  targetId,
  relationship,
  relationshipSource,
) => {
  if (!RELATIONSHIP_TYPES.has(relationship.type)) {
    throw new Error(`Unsupported relationship type: ${relationship.type}`);
  }
  const result = await query(
    `INSERT INTO document_relationships (
       from_document_id,
       to_document_id,
       relationship_type,
       relationship_strength,
       relationship_source,
       confidence,
       explanation,
       relationship_evidence,
       source_name,
       metadata_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $5, $8::jsonb)
     ON CONFLICT (from_document_id, to_document_id, relationship_type)
     DO UPDATE SET
       relationship_strength = GREATEST(
         document_relationships.relationship_strength,
         EXCLUDED.relationship_strength
       ),
       confidence = GREATEST(
         document_relationships.confidence,
         EXCLUDED.confidence
       ),
       explanation = EXCLUDED.explanation,
       relationship_evidence =
         document_relationships.relationship_evidence ||
         EXCLUDED.relationship_evidence,
       relationship_source = EXCLUDED.relationship_source,
       updated_at = NOW()
     RETURNING id`,
    [
      sourceId,
      targetId,
      relationship.type,
      relationship.strength,
      relationshipSource,
      relationship.confidence,
      relationship.explanation,
      JSON.stringify(relationship.evidence || {}),
    ],
  );
  return result.rows[0]?.id;
};

const persistRelationshipPair = async (
  sourceId,
  targetId,
  relationship,
  relationshipSource = "heuristic",
) => {
  const forwardId = await upsertRelationship(
    sourceId,
    targetId,
    relationship,
    relationshipSource,
  );
  const inverseType = INVERSE_RELATIONSHIPS[relationship.type];
  let inverseId = null;
  if (inverseType) {
    inverseId = await upsertRelationship(
      targetId,
      sourceId,
      {
        ...relationship,
        type: inverseType,
        explanation: `Inverse of ${relationship.type}: ${relationship.explanation}`,
        evidence: {
          ...(relationship.evidence || {}),
          inverseOf: relationship.type,
        },
      },
      relationshipSource,
    );
  }
  return { forwardId, inverseId };
};

const discoverRelationshipsForDocument = async (
  documentId,
  { verifyWithAI = true, candidateLimit = 100 } = {},
) => {
  const source = await loadDocument(documentId);
  if (!source) {
    const error = new Error("Public document not found.");
    error.status = 404;
    throw error;
  }
  const candidates = await loadCandidates(source, candidateLimit);
  const discovered = [];
  for (const target of candidates) {
    let relationship = inferRelationship(source, target);
    if (!relationship || relationship.confidence < 0.5) continue;
    let relationshipSource = "metadata_heuristic";
    if (
      verifyWithAI &&
      (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY) &&
      providerConfig().credentialsConfigured &&
      relationship.confidence < 0.9
    ) {
      try {
        const verification = await verifyDocumentRelationship({
          sourceDocument: {
            id: source.id,
            title: source.title,
            type: source.document_type,
            legalIdentifier: source.legal_identifier,
            ministry: source.ministry,
            state: source.state,
          },
          targetDocument: {
            id: target.id,
            title: target.title,
            type: target.document_type,
            legalIdentifier: target.legal_identifier,
            ministry: target.ministry,
            state: target.state,
          },
          proposedRelationship: relationship.type,
          evidence: relationship.evidence,
        });
        if (
          !verification.supported ||
          !RELATIONSHIP_TYPES.has(verification.relationshipType) ||
          verification.confidence < 0.55
        ) {
          continue;
        }
        relationship = {
          ...relationship,
          type: verification.relationshipType,
          confidence: verification.confidence,
          explanation:
            verification.explanation || relationship.explanation,
          evidence: {
            ...relationship.evidence,
            aiEvidenceQuote: verification.evidenceQuote || null,
            aiVerified: true,
          },
        };
        relationshipSource = "openai_verified_heuristic";
      } catch (error) {
        console.warn(
          "Relationship AI verification unavailable; retaining only strong heuristics:",
          error.message,
        );
        if (relationship.confidence < 0.72) continue;
      }
    }
    const ids = await persistRelationshipPair(
      source.id,
      target.id,
      relationship,
      relationshipSource,
    );
    discovered.push({
      sourceDocumentId: String(source.id),
      targetDocumentId: String(target.id),
      targetTitle: target.title,
      ...relationship,
      ...ids,
      relationshipSource,
    });
  }
  return {
    documentId: String(source.id),
    candidatesEvaluated: candidates.length,
    relationshipsStored: discovered.length,
    relationships: discovered,
  };
};

const discoverRelationshipBatch = async ({
  limit = 100,
  offset = 0,
  verifyWithAI = true,
  concurrency = 5,
} = {}) => {
  const documents = await query(
    `SELECT id
     FROM documents
     WHERE visibility_status = 'public'
       AND title IS NOT NULL
       AND quality_score >= 35
     ORDER BY updated_at DESC, id
     LIMIT $1 OFFSET $2`,
    [
      Math.min(Math.max(Number(limit) || 100, 1), 1_000),
      Math.max(Number(offset) || 0, 0),
    ],
  );
  const results = [];
  const safeConcurrency = Math.min(Math.max(Number(concurrency) || 5, 1), 10);
  for (let index = 0; index < documents.rows.length; index += safeConcurrency) {
    const batch = documents.rows.slice(index, index + safeConcurrency);
    results.push(
      ...(await Promise.all(
        batch.map((document) =>
          discoverRelationshipsForDocument(document.id, {
            verifyWithAI,
          }),
        ),
      )),
    );
  }
  return {
    documentsProcessed: results.length,
    relationshipsStored: results.reduce(
      (sum, result) => sum + result.relationshipsStored,
      0,
    ),
    results,
  };
};

module.exports = {
  INVERSE_RELATIONSHIPS,
  RELATIONSHIP_TYPES,
  discoverRelationshipBatch,
  discoverRelationshipsForDocument,
  inferRelationship,
  normalizedTokens,
  persistRelationshipPair,
  titleSimilarity,
};
