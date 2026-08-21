const crypto = require("node:crypto");
const { getPool, query } = require("../db");
const {
  estimateEmbeddingTokens,
  getActIndex,
  getEGazetteIndex,
  getIndex,
  getPolicyIndex,
  providerConfig,
  storeRoutingRepresentations,
} = require("../lib/vectordb");
const { normalizeDocumentType, retrievalFamilyForType } = require("./documentTypes");

const LARGE_DOCUMENT_THRESHOLD = 100;
const LARGE_DOCUMENT_INDEX_VERSION = "hierarchical-large-document-v1";
const sha256 = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const familyConfig = {
  bill: { index: getIndex, idField: "billId", titleField: "billTitle" },
  act: { index: getActIndex, idField: "actId", titleField: "actTitle" },
  gazette: { index: getEGazetteIndex, idField: "gazetteId", titleField: "gazetteTitle" },
  policy: { index: getPolicyIndex, idField: "policyId", titleField: "policyTitle" },
};

const structuralLabel = (row) => {
  const metadata = row.metadata_json || {};
  return metadata.sectionTitle || metadata.sectionId || metadata.clauseId ||
    metadata.structuralType || `Chunks ${row.chunk_index}`;
};

const groupRepresentation = (rows, title) => {
  const picks = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]]
    .filter(Boolean);
  const excerpts = [...new Set(picks.map((row) =>
    String(row.translated_text || row.original_text || "").trim().slice(0, 1_600)))]
    .filter(Boolean);
  return [`Document: ${title}`, `Structure: ${structuralLabel(rows[0])}`, ...excerpts]
    .join("\n\n").slice(0, 5_500);
};

const buildStructuralGroups = (rows, {
  title = "Large document", targetChunks = 12, maxChunks = 24,
} = {}) => {
  const target = Math.min(20, Math.max(6, Number(targetChunks) || 12));
  const maximum = Math.min(32, Math.max(target, Number(maxChunks) || 24));
  const groups = [];
  let current = [];
  for (const row of rows) {
    const labelChanged = current.length > 0 && structuralLabel(row) !== structuralLabel(current[0]);
    if (current.length >= maximum || (current.length >= target && labelChanged)) {
      groups.push(current);
      current = [];
    }
    current.push(row);
  }
  if (current.length) groups.push(current);
  return groups.map((children, groupIndex) => {
    const representationText = groupRepresentation(children, title);
    return {
      groupIndex,
      groupTitle: structuralLabel(children[0]),
      childStart: Number(children[0].chunk_index),
      childEnd: Number(children[children.length - 1].chunk_index),
      childCount: children.length,
      representationText,
      representationHash: sha256(representationText),
    };
  });
};

const largeDocumentPolicy = (chunkCount) => Number(chunkCount || 0) > LARGE_DOCUMENT_THRESHOLD
  ? { mode: "hierarchical", standardChunkCeiling: LARGE_DOCUMENT_THRESHOLD }
  : { mode: "standard", standardChunkCeiling: LARGE_DOCUMENT_THRESHOLD };

const loadLargeDocument = async (documentId, queryFn = query) => {
  const [documentResult, chunksResult] = await Promise.all([
    queryFn(`SELECT document.id, document.title, document.document_type,
       document.visibility_status, state.search_ready, state.semantic_ready,
       state.hierarchical_semantic_ready
     FROM documents document
     JOIN document_processing_state state ON state.document_id = document.id
     WHERE document.id = $1`, [documentId]),
    queryFn(`SELECT chunk_index, original_text, translated_text, language, metadata_json
     FROM document_text_chunks WHERE document_id = $1 ORDER BY chunk_index LIMIT 2001`, [documentId]),
  ]);
  return { document: documentResult.rows[0] || null, rows: chunksResult.rows };
};

const persistLargeDocumentGroups = async ({ document, groups, representations, namespace }) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM document_chunk_groups WHERE document_id = $1", [document.id]);
    for (const group of groups) {
      await client.query(`INSERT INTO document_chunk_groups (
         document_id, group_index, group_title, child_start_index, child_end_index,
         child_count, representation_text, representation_hash, vector_reference,
         embedding_namespace, metadata_json
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`, [
        document.id, group.groupIndex, group.groupTitle, group.childStart, group.childEnd,
        group.childCount, group.representationText, group.representationHash,
        representations[group.groupIndex].id, namespace,
        JSON.stringify({ routingOnly: true, evidenceSource: "child_chunks",
          indexVersion: LARGE_DOCUMENT_INDEX_VERSION }),
      ]);
    }
    await client.query(`UPDATE document_processing_state SET
       hierarchical_semantic_ready = TRUE, hierarchical_vectors_count = $2,
       hierarchical_index_version = $3, capabilities_updated_at = NOW(), updated_at = NOW()
     WHERE document_id = $1`, [document.id, groups.length, LARGE_DOCUMENT_INDEX_VERSION]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const indexLargeDocument = async ({
  documentId, dryRun = false, queryFn = query, storeFn = storeRoutingRepresentations,
  persistFn = persistLargeDocumentGroups, targetChunks = 12, maxChunks = 24,
} = {}) => {
  const { document, rows } = await loadLargeDocument(documentId, queryFn);
  if (!document) throw new Error("Document was not found.");
  if (document.visibility_status !== "public" || !document.search_ready) {
    throw new Error("Large-document indexing requires a public search-ready document.");
  }
  if (rows.length <= LARGE_DOCUMENT_THRESHOLD) {
    throw new Error("Standard-sized documents must use the ordinary semantic path.");
  }
  if (rows.length > 2_000) {
    throw new Error("Documents above 2,000 chunks require an explicit operator review.");
  }
  const family = retrievalFamilyForType(normalizeDocumentType(document.document_type));
  const config = familyConfig[family];
  if (!config) throw new Error(`Unsupported large-document family: ${family}`);
  const groups = buildStructuralGroups(rows, { title: document.title, targetChunks, maxChunks });
  const embeddingTokens = groups.reduce(
    (total, group) => total + estimateEmbeddingTokens(group.representationText), 0);
  const result = {
    documentId: String(document.id), family, childChunks: rows.length,
    routingGroups: groups.length, vectorReductionPercent: Number(
      ((1 - groups.length / rows.length) * 100).toFixed(2)),
    estimatedEmbeddingTokens: embeddingTokens, standardChunkCeiling: LARGE_DOCUMENT_THRESHOLD,
    downloads: 0, ocrPages: 0,
  };
  if (dryRun) return { ...result, status: "dry_run" };

  const namespace = providerConfig().vectorNamespace;
  const representations = groups.map((group) => ({
    id: `large-${family}-${document.id}-group-${group.groupIndex}`,
    documentId: document.id,
    title: document.title,
    embeddingText: group.representationText,
    groupIndex: group.groupIndex,
    groupTitle: group.groupTitle,
    childStart: group.childStart,
    childEnd: group.childEnd,
    metadata: { documentId: String(document.id), largeDocumentIndexVersion: LARGE_DOCUMENT_INDEX_VERSION },
  }));
  const stored = await storeFn({ representations, index: config.index(),
    idField: config.idField, titleField: config.titleField });
  await persistFn({ document, groups, representations, namespace });
  return { ...result, status: "indexed", vectorsStored: stored.stored,
    embeddingsMs: stored.embeddingsMs, pineconeMs: stored.pineconeMs };
};

const overlapScore = (text, queryText) => {
  const tokens = [...new Set(String(queryText || "").toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ").split(/\s+/u).filter((token) => token.length >= 3))];
  if (!tokens.length) return 0;
  const content = String(text || "").toLowerCase();
  return tokens.filter((token) => content.includes(token)).length / tokens.length;
};

const expandLargeDocumentMatches = async ({ matches, documentId, message, queryFn = query }) => {
  const routing = (matches || []).filter((match) => match.metadata?.routingOnly === true)
    .slice(0, 6);
  if (!routing.length) return null;
  const ranges = routing.map((match) => ({
    start: Number(match.metadata.childStart), end: Number(match.metadata.childEnd),
    score: Number(match.score || match.relevanceScore || 0),
  })).filter((range) => Number.isInteger(range.start) && Number.isInteger(range.end));
  if (!ranges.length) return null;
  const result = await queryFn(`SELECT chunk_index, original_text, translated_text,
       language, metadata_json
     FROM document_text_chunks chunk
     WHERE document_id = $1 AND EXISTS (
       SELECT 1 FROM jsonb_to_recordset($2::jsonb) AS selected(start_index INTEGER, end_index INTEGER)
       WHERE chunk.chunk_index BETWEEN selected.start_index AND selected.end_index
     )
     ORDER BY chunk_index LIMIT 160`, [documentId, JSON.stringify(ranges.map((range) => ({
      start_index: range.start, end_index: range.end,
    })))]);
  return result.rows.map((row) => {
    const metadata = row.metadata_json || {};
    const content = String(row.original_text || row.translated_text || "").trim();
    const parent = ranges.find((range) =>
      Number(row.chunk_index) >= range.start && Number(row.chunk_index) <= range.end);
    return {
      content, score: (parent?.score || 0) * 0.7 + overlapScore(content, message) * 0.3,
      vectorScore: parent?.score || 0, chunkIndex: Number(row.chunk_index),
      languageCode: metadata.languageCode || row.language || "und",
      pageStart: metadata.pageStart || null, pageEnd: metadata.pageEnd || null,
      pageEstimate: Boolean(metadata.pageEstimate), sectionId: metadata.sectionId || null,
      sectionTitle: metadata.sectionTitle || null, clauseId: metadata.clauseId || null,
      structuralType: metadata.structuralType || "passage", source: metadata.source || "Indexed document text",
      sourceUrl: metadata.sourceUrl || null, pdfUrl: metadata.pdfUrl || null,
      retrievalMode: "hierarchical_vector", routedFromRepresentation: true,
    };
  }).filter((passage) => passage.content)
    .sort((left, right) => right.score - left.score)
    .slice(0, 30)
    .map((passage, index) => ({ ...passage, passage: index + 1 }));
};

module.exports = {
  LARGE_DOCUMENT_INDEX_VERSION,
  LARGE_DOCUMENT_THRESHOLD,
  buildStructuralGroups,
  expandLargeDocumentMatches,
  indexLargeDocument,
  largeDocumentPolicy,
  persistLargeDocumentGroups,
};
