const crypto = require("node:crypto");
const { query } = require("../db");

const NODE_TYPES = new Set([
  "CONCEPT", "DEFINITION", "OBLIGATION", "RIGHT", "PROHIBITION",
  "EXEMPTION", "PENALTY", "PROCEDURE", "AUTHORITY", "INDUSTRY",
  "JURISDICTION", "SCHEME", "REQUIREMENT", "ENTITY",
]);

const VERIFICATION_STATES = new Set([
  "SOURCE_VERIFIED", "MODEL_EXTRACTED", "MODEL_CHECKED",
  "HUMAN_VERIFIED", "DISPUTED", "QUARANTINED",
]);

const FACT_ELIGIBLE_STATES = new Set(["SOURCE_VERIFIED", "HUMAN_VERIFIED"]);
const DISCOVERY_STATES = new Set([
  "SOURCE_VERIFIED", "MODEL_CHECKED", "HUMAN_VERIFIED", "MODEL_EXTRACTED",
]);

const normalizeText = (value, maximum = 500) => String(value || "")
  .normalize("NFKC")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

const normalizeCanonicalName = (value) => normalizeText(value, 240)
  .toLocaleLowerCase("en-IN")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const normalizeJurisdiction = (value) => normalizeText(value || "unspecified", 120)
  .toLocaleLowerCase("en-IN");

const normalizeEnum = (value, allowed, label) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!allowed.has(normalized)) throw new Error(`Unsupported ${label}: ${normalized || "empty"}`);
  return normalized;
};

const evidenceHash = (evidence = {}) => crypto.createHash("sha256").update([
  evidence.documentId || "",
  evidence.chunkId || "",
  evidence.resourceId || "",
  evidence.pageStart || "",
  evidence.section || evidence.sectionLabel || "",
  evidence.clause || evidence.clauseLabel || "",
  normalizeText(evidence.evidenceSpan, 4_000),
].join("|")).digest("hex");

const normalizeEvidence = (value = {}, ownerUserId = null) => {
  const evidenceSpan = normalizeText(value.evidenceSpan || value.content, 4_000);
  const documentId = Number(value.documentId) || null;
  const evidenceOwner = Number(value.ownerUserId || ownerUserId) || null;
  if (!evidenceSpan || (!documentId && !evidenceOwner)) {
    throw new Error("Knowledge evidence requires a bounded evidence span and an original document or owner.");
  }
  if (evidenceOwner && ownerUserId && evidenceOwner !== Number(ownerUserId)) {
    throw new Error("Private knowledge evidence belongs to another account.");
  }
  const evidence = {
    documentId,
    chunkId: Number(value.chunkId) || null,
    resourceId: Number(value.resourceId) || null,
    ownerUserId: evidenceOwner,
    pageStart: Number(value.pageStart) || null,
    pageEnd: Number(value.pageEnd) || null,
    sectionLabel: normalizeText(value.section || value.sectionLabel, 120) || null,
    clauseLabel: normalizeText(value.clause || value.clauseLabel, 120) || null,
    evidenceSpan,
    sourceUrl: normalizeText(value.sourceUrl, 1_000) || null,
  };
  return { ...evidence, evidenceHash: evidenceHash(evidence) };
};

const normalizeKnowledgeNode = (value = {}) => {
  const nodeType = normalizeEnum(value.nodeType, NODE_TYPES, "knowledge node type");
  const canonicalName = normalizeText(value.canonicalName, 240);
  if (!canonicalName) throw new Error("Knowledge node canonical name is required.");
  const verificationStatus = normalizeEnum(
    value.verificationStatus || "MODEL_EXTRACTED",
    VERIFICATION_STATES,
    "verification state",
  );
  const ownerUserId = Number(value.ownerUserId) || null;
  const evidence = (value.evidence || []).map((item) => normalizeEvidence(item, ownerUserId));
  const generationMethod = normalizeText(value.generationMethod || "deterministic", 80);
  if (FACT_ELIGIBLE_STATES.has(verificationStatus) && !evidence.length) {
    throw new Error("Verified knowledge nodes require original source evidence.");
  }
  if (/(?:^|[_\s-])(?:ai|model|llm)(?:[_\s-]|$)/i.test(generationMethod) && !evidence.length) {
    throw new Error("AI-extracted knowledge nodes require original source evidence.");
  }
  return {
    nodeType,
    canonicalName,
    normalizedName: normalizeCanonicalName(canonicalName),
    description: normalizeText(value.description, 2_000) || null,
    jurisdiction: normalizeJurisdiction(value.jurisdiction),
    authorityId: Number(value.authorityId) || null,
    effectiveFrom: value.effectiveFrom || null,
    effectiveTo: value.effectiveTo || null,
    verificationStatus,
    generationMethod,
    modelVersion: normalizeText(value.modelVersion, 120) || null,
    ownerUserId,
    metadata: value.metadata && typeof value.metadata === "object" ? value.metadata : {},
    evidence,
  };
};

const normalizeKnowledgeEdge = (value = {}) => {
  const sourceNodeId = Number(value.sourceNodeId);
  const targetNodeId = Number(value.targetNodeId);
  if (!Number.isSafeInteger(sourceNodeId) || !Number.isSafeInteger(targetNodeId) ||
      sourceNodeId <= 0 || targetNodeId <= 0 || sourceNodeId === targetNodeId) {
    throw new Error("Knowledge edge requires two different valid node IDs.");
  }
  const relationshipType = String(value.relationshipType || "").trim().toUpperCase();
  if (!/^[A-Z_]{2,80}$/.test(relationshipType)) throw new Error("Invalid knowledge relationship type.");
  const verificationStatus = normalizeEnum(
    value.verificationStatus || "MODEL_EXTRACTED",
    VERIFICATION_STATES,
    "verification state",
  );
  const evidence = (value.evidence || []).map((item) => normalizeEvidence(item, value.ownerUserId));
  const generationMethod = normalizeText(value.generationMethod || "deterministic", 80);
  if (FACT_ELIGIBLE_STATES.has(verificationStatus) && !evidence.length) {
    throw new Error("Verified knowledge edges require original source evidence.");
  }
  if (/(?:^|[_\s-])(?:ai|model|llm)(?:[_\s-]|$)/i.test(generationMethod) && !evidence.length) {
    throw new Error("AI-extracted knowledge edges require original source evidence.");
  }
  return {
    sourceNodeId,
    targetNodeId,
    relationshipType,
    verificationStatus,
    confidence: value.confidence == null ? null : Math.max(0, Math.min(1, Number(value.confidence))),
    generationMethod,
    modelVersion: normalizeText(value.modelVersion, 120) || null,
    metadata: value.metadata && typeof value.metadata === "object" ? value.metadata : {},
    evidence,
  };
};

const canExposeAsLegalFact = (value) => FACT_ELIGIBLE_STATES.has(
  String(value?.verificationStatus || value || "").toUpperCase(),
);

const canUseForDiscovery = (value) => DISCOVERY_STATES.has(
  String(value?.verificationStatus || value || "").toUpperCase(),
);

const deduplicateKnowledgeNodes = (nodes = []) => {
  const byIdentity = new Map();
  for (const value of nodes) {
    const node = normalizeKnowledgeNode(value);
    const key = [node.ownerUserId || "public", node.nodeType, node.normalizedName, node.jurisdiction].join(":");
    const existing = byIdentity.get(key);
    if (!existing || node.evidence.length > existing.evidence.length) byIdentity.set(key, node);
  }
  return [...byIdentity.values()];
};

const numericFacts = (value) => normalizeText(value, 4_000).match(/\b\d+(?:\.\d+)?%?\b/g) || [];

const detectKnowledgeConflicts = (records = []) => {
  const groups = new Map();
  for (const record of records) {
    const key = [record.nodeType, normalizeCanonicalName(record.canonicalName), normalizeJurisdiction(record.jurisdiction)].join(":");
    groups.set(key, [...(groups.get(key) || []), record]);
  }
  const conflicts = [];
  for (const [identity, values] of groups) {
    for (let left = 0; left < values.length; left += 1) {
      for (let right = left + 1; right < values.length; right += 1) {
        const a = numericFacts(values[left].evidenceSpan);
        const b = numericFacts(values[right].evidenceSpan);
        if (a.length && b.length && !a.some((number) => b.includes(number))) {
          conflicts.push({ identity, left: values[left], right: values[right], status: "DISPUTED" });
        }
      }
    }
  }
  return conflicts;
};

const eligibleForKnowledgeExtraction = (document = {}) => Boolean(
  document.searchReady &&
  (document.priority === "P0" || document.priority === "P1" ||
   Number(document.authorityTier || 9) <= 2 || Number(document.accessCount || 0) >= 10),
);

const sentenceCandidates = (text) => normalizeText(text, 12_000)
  .split(/(?<=[.!?।])\s+/u)
  .map((sentence) => sentence.trim())
  .filter((sentence) => sentence.length >= 30 && sentence.length <= 1_200);

const extractionType = (sentence) => {
  if (/\b(?:means|defined as|refers to)\b/i.test(sentence)) return "DEFINITION";
  if (/\b(?:penalty|fine|punishable|imprisonment)\b/i.test(sentence)) return "PENALTY";
  if (/\b(?:shall not|must not|prohibited|no person shall)\b/i.test(sentence)) return "PROHIBITION";
  if (/\b(?:exempt|exemption|shall not apply)\b/i.test(sentence)) return "EXEMPTION";
  if (/\b(?:shall|must|required to|duty to)\b/i.test(sentence)) return "OBLIGATION";
  if (/\b(?:entitled|right to|may apply)\b/i.test(sentence)) return "RIGHT";
  if (/\b(?:procedure|application shall|submit|filing|registration)\b/i.test(sentence)) return "PROCEDURE";
  return null;
};

const extractedCanonicalName = (type, sentence) => {
  const subject = sentence
    .replace(/^.*?\b(?:shall not|must not|shall|must|required to|means|is defined as|penalty|fine)\b/i, "")
    .replace(/\[[^\]]+\]/g, "")
    .trim()
    .slice(0, 120);
  return subject ? `${type.toLowerCase().replaceAll("_", " ")}: ${subject}` : null;
};

const extractKnowledgeCandidates = (document, passages = []) => {
  if (!eligibleForKnowledgeExtraction(document)) return [];
  const candidates = [];
  for (const passage of passages.slice(0, 80)) {
    for (const sentence of sentenceCandidates(passage.content || passage.originalText)) {
      const nodeType = extractionType(sentence);
      const canonicalName = nodeType && extractedCanonicalName(nodeType, sentence);
      if (!nodeType || !canonicalName) continue;
      candidates.push({
        nodeType,
        canonicalName,
        description: sentence,
        jurisdiction: document.jurisdiction || document.state || "unspecified",
        verificationStatus: "MODEL_CHECKED",
        generationMethod: "deterministic_supported_sentence_v1",
        metadata: { documentType: document.type || document.documentType },
        evidence: [{
          documentId: document.id,
          chunkId: passage.chunkId,
          resourceId: passage.resourceId,
          pageStart: passage.pageStart,
          pageEnd: passage.pageEnd,
          sectionLabel: passage.sectionId || passage.sectionTitle,
          clauseLabel: passage.clauseId,
          evidenceSpan: sentence,
          sourceUrl: passage.sourceUrl || document.sourceUrl,
        }],
      });
    }
  }
  return deduplicateKnowledgeNodes(candidates).slice(0, 40);
};

const insertEvidence = async (target, evidence, execute = query) => execute(
  `INSERT INTO knowledge_evidence (
     knowledge_node_id, knowledge_edge_id, document_id, chunk_id, resource_id,
     owner_user_id, page_start, page_end, section_label, clause_label,
     evidence_span, evidence_hash, source_url
   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
   ON CONFLICT DO NOTHING`,
  [target.nodeId || null, target.edgeId || null, evidence.documentId, evidence.chunkId,
    evidence.resourceId, evidence.ownerUserId, evidence.pageStart, evidence.pageEnd,
    evidence.sectionLabel, evidence.clauseLabel, evidence.evidenceSpan,
    evidence.evidenceHash, evidence.sourceUrl],
);

const upsertKnowledgeNode = async (value, execute = query) => {
  const node = normalizeKnowledgeNode(value);
  const initialStatus = "MODEL_EXTRACTED";
  const conflictTarget = node.ownerUserId
    ? `(owner_user_id, node_type, normalized_name, jurisdiction) WHERE owner_user_id IS NOT NULL`
    : `(node_type, normalized_name, jurisdiction) WHERE owner_user_id IS NULL`;
  const result = await execute(
    `INSERT INTO knowledge_nodes (
       node_type, canonical_name, normalized_name, description, jurisdiction,
       authority_id, effective_from, effective_to, verification_status,
       generation_method, model_version, owner_user_id, metadata_json
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     ON CONFLICT ${conflictTarget}
     DO UPDATE SET description = COALESCE(EXCLUDED.description, knowledge_nodes.description),
       metadata_json = knowledge_nodes.metadata_json || EXCLUDED.metadata_json,
       updated_at = NOW()
     RETURNING id`,
    [node.nodeType, node.canonicalName, node.normalizedName, node.description,
      node.jurisdiction, node.authorityId, node.effectiveFrom, node.effectiveTo,
      node.ownerUserId ? "MODEL_EXTRACTED" : initialStatus, node.generationMethod,
      node.modelVersion, node.ownerUserId, JSON.stringify(node.metadata)],
  );
  const nodeId = Number(result.rows[0].id);
  for (const evidence of node.evidence) await insertEvidence({ nodeId }, evidence, execute);
  if (node.evidence.length && node.verificationStatus !== initialStatus) {
    await execute(
      `UPDATE knowledge_nodes SET verification_status = $2, updated_at = NOW()
       WHERE id = $1 AND EXISTS (
         SELECT 1 FROM knowledge_evidence WHERE knowledge_node_id = $1
       )`,
      [nodeId, node.verificationStatus],
    );
  }
  return { ...node, id: nodeId };
};

const upsertKnowledgeEdge = async (value, execute = query) => {
  const edge = normalizeKnowledgeEdge(value);
  const initialStatus = "MODEL_EXTRACTED";
  const result = await execute(
    `INSERT INTO knowledge_edges (
       source_node_id, relationship_type, target_node_id, verification_status,
       confidence, generation_method, model_version, metadata_json
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (source_node_id, relationship_type, target_node_id)
     DO UPDATE SET confidence = GREATEST(knowledge_edges.confidence, EXCLUDED.confidence),
       metadata_json = knowledge_edges.metadata_json || EXCLUDED.metadata_json,
       updated_at = NOW()
     RETURNING id`,
    [edge.sourceNodeId, edge.relationshipType, edge.targetNodeId, initialStatus,
      edge.confidence, edge.generationMethod, edge.modelVersion, JSON.stringify(edge.metadata)],
  );
  const edgeId = Number(result.rows[0].id);
  for (const evidence of edge.evidence) await insertEvidence({ edgeId }, evidence, execute);
  if (edge.evidence.length && edge.verificationStatus !== initialStatus) {
    await execute(
      `UPDATE knowledge_edges SET verification_status = $2, updated_at = NOW()
       WHERE id = $1 AND EXISTS (
         SELECT 1 FROM knowledge_evidence WHERE knowledge_edge_id = $1
       )`,
      [edgeId, edge.verificationStatus],
    );
  }
  return { ...edge, id: edgeId };
};

const discoverKnowledgeCandidates = async (searchQuery, options = {}) => {
  const text = normalizeText(searchQuery, 500);
  if (!text) return { concepts: [], documentIds: [], evidence: [] };
  const limit = Math.min(30, Math.max(1, Number(options.limit || 12)));
  const userId = Number(options.userId) || null;
  const execute = options.execute || query;
  const result = await execute(
    `SELECT node.id, node.node_type, node.canonical_name, node.description,
       node.jurisdiction, node.verification_status, node.owner_user_id,
       evidence.document_id, evidence.chunk_id, evidence.page_start,
       evidence.page_end, evidence.section_label, evidence.clause_label,
       evidence.evidence_span, evidence.source_url
     FROM knowledge_nodes node
     JOIN knowledge_evidence evidence ON evidence.knowledge_node_id = node.id
     WHERE node.verification_status = ANY($1::TEXT[])
       AND node.verification_status NOT IN ('QUARANTINED', 'DISPUTED')
       AND (node.owner_user_id IS NULL OR node.owner_user_id = $2)
       AND (evidence.owner_user_id IS NULL OR evidence.owner_user_id = $2)
       AND (
         to_tsvector('simple', node.canonical_name || ' ' || COALESCE(node.description, ''))
           @@ plainto_tsquery('simple', $3)
         OR node.canonical_name ILIKE '%' || $3 || '%'
         OR EXISTS (
           SELECT 1 FROM UNNEST(regexp_split_to_array($3, '\\s+')) token
           WHERE LENGTH(token) >= 3
             AND (node.canonical_name || ' ' || COALESCE(node.description, ''))
               ILIKE '%' || token || '%'
         )
       )
     ORDER BY CASE node.verification_status
       WHEN 'HUMAN_VERIFIED' THEN 0 WHEN 'SOURCE_VERIFIED' THEN 1
       WHEN 'MODEL_CHECKED' THEN 2 ELSE 3 END, node.updated_at DESC
     LIMIT $4`,
    [[...DISCOVERY_STATES], userId, text, limit],
  );
  const rows = result.rows || [];
  return {
    concepts: [...new Map(rows.map((row) => [String(row.id), {
      id: String(row.id), nodeType: row.node_type, canonicalName: row.canonical_name,
      jurisdiction: row.jurisdiction, verificationStatus: row.verification_status,
      legalFact: canExposeAsLegalFact(row.verification_status),
    }])).values()],
    documentIds: [...new Set(rows.map((row) => row.document_id).filter(Boolean).map(String))],
    evidence: rows.map((row) => ({
      documentId: row.document_id == null ? null : String(row.document_id),
      chunkId: row.chunk_id == null ? null : String(row.chunk_id),
      content: row.evidence_span,
      pageStart: row.page_start,
      pageEnd: row.page_end,
      sectionId: row.section_label,
      clauseId: row.clause_label,
      sourceUrl: row.source_url,
      retrievalMode: "knowledge_discovery",
      knowledgeDiscoveryOnly: true,
    })),
  };
};

const prepareKnowledgeForDocument = async (document, passages, options = {}) => {
  const candidates = extractKnowledgeCandidates(document, passages);
  const stored = [];
  for (const candidate of candidates) {
    stored.push(await upsertKnowledgeNode(candidate, options.execute || query));
  }
  return { eligible: eligibleForKnowledgeExtraction(document), extracted: candidates.length, stored };
};

const traverseKnowledge = async (nodeId, options = {}) => {
  const id = Number(nodeId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Knowledge node ID must be positive.");
  const maxDepth = Math.min(3, Math.max(1, Number(options.maxDepth || 2)));
  const limit = Math.min(100, Math.max(1, Number(options.limit || 40)));
  const execute = options.execute || query;
  const result = await execute(
    `WITH RECURSIVE walk(node_id, depth, path) AS (
       SELECT $1::BIGINT, 0, ARRAY[$1::BIGINT]
       UNION ALL
       SELECT edge.target_node_id, walk.depth + 1, path || edge.target_node_id
       FROM walk JOIN LATERAL (
         SELECT candidate.* FROM knowledge_edges candidate
         WHERE candidate.source_node_id = walk.node_id
           AND candidate.verification_status NOT IN ('QUARANTINED', 'DISPUTED')
         ORDER BY candidate.confidence DESC NULLS LAST LIMIT 20
       ) edge ON TRUE
       WHERE walk.depth < $2 AND NOT edge.target_node_id = ANY(path)
     ) SELECT DISTINCT node_id, depth FROM walk ORDER BY depth, node_id LIMIT $3`,
    [id, maxDepth, limit],
  );
  return result.rows || [];
};

const buildPortableKnowledgeObject = (node, evidence = []) => {
  if (!canExposeAsLegalFact(node)) throw new Error("Only verified knowledge can be exported as a portable object.");
  const lines = [
    "---",
    `type: ${String(node.nodeType || "concept").toLowerCase()}`,
    `jurisdiction: ${node.jurisdiction || "unspecified"}`,
    `verification: ${String(node.verificationStatus).toLowerCase()}`,
    "---",
    "",
    `# ${node.canonicalName}`,
    "",
    node.description || "",
    "",
    "## Evidence",
    "",
    ...evidence.map((item) => `- ${item.documentTitle || `Document ${item.documentId}`}${item.sectionLabel ? `, ${item.sectionLabel}` : ""}: ${normalizeText(item.evidenceSpan, 500)}`),
  ];
  return lines.filter((line, index) => line || index !== 8).join("\n").trim();
};

const exportKnowledgeNode = async (nodeId, userId, options = {}) => {
  const id = Number(nodeId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Knowledge node ID must be positive.");
  const execute = options.execute || query;
  const result = await execute(
    `SELECT node.id, node.node_type, node.canonical_name, node.description,
       node.jurisdiction, node.verification_status, node.owner_user_id,
       evidence.document_id, evidence.section_label, evidence.evidence_span,
       document.title AS document_title
     FROM knowledge_nodes node
     JOIN knowledge_evidence evidence ON evidence.knowledge_node_id = node.id
     LEFT JOIN legislative_documents document ON document.id = evidence.document_id
     WHERE node.id = $1
       AND (node.owner_user_id IS NULL OR node.owner_user_id = $2)
       AND (evidence.owner_user_id IS NULL OR evidence.owner_user_id = $2)
     ORDER BY evidence.id`,
    [id, Number(userId) || null],
  );
  if (!result.rows?.length) {
    const error = new Error("Verified knowledge object not found.");
    error.status = 404;
    throw error;
  }
  const row = result.rows[0];
  const node = {
    id: String(row.id),
    nodeType: row.node_type,
    canonicalName: row.canonical_name,
    description: row.description,
    jurisdiction: row.jurisdiction,
    verificationStatus: row.verification_status,
  };
  return buildPortableKnowledgeObject(node, result.rows.map((item) => ({
    documentId: item.document_id,
    documentTitle: item.document_title,
    sectionLabel: item.section_label,
    evidenceSpan: item.evidence_span,
  })));
};

module.exports = {
  DISCOVERY_STATES,
  FACT_ELIGIBLE_STATES,
  NODE_TYPES,
  VERIFICATION_STATES,
  buildPortableKnowledgeObject,
  canExposeAsLegalFact,
  canUseForDiscovery,
  deduplicateKnowledgeNodes,
  detectKnowledgeConflicts,
  discoverKnowledgeCandidates,
  eligibleForKnowledgeExtraction,
  evidenceHash,
  exportKnowledgeNode,
  extractKnowledgeCandidates,
  normalizeCanonicalName,
  normalizeKnowledgeEdge,
  normalizeKnowledgeNode,
  prepareKnowledgeForDocument,
  traverseKnowledge,
  upsertKnowledgeEdge,
  upsertKnowledgeNode,
};
