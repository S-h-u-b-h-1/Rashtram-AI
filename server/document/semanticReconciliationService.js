const { query } = require("../db");
const {
  getActIndex,
  getIndex,
  providerConfig,
} = require("../lib/vectordb");
const { retrievalFamilyForType } = require("./documentTypes");
const {
  backfillSemanticDocument,
  sha256,
} = require("./semanticBackfillService");

const PINECONE_PAGE_SIZE = 100;

const expectedIndexName = (documentType) =>
  retrievalFamilyForType(documentType) === "bill" ? "bill" : "act";

const listVectorIds = async (index) => {
  const ids = [];
  let paginationToken;
  do {
    const page = await index.listPaginated({
      limit: PINECONE_PAGE_SIZE,
      paginationToken,
    });
    ids.push(...(page.vectors || []).map((vector) => vector.id));
    paginationToken = page.pagination?.next;
  } while (paginationToken);
  return ids;
};

const fetchVectorRecords = async (index, ids) => {
  const records = {};
  for (let offset = 0; offset < ids.length; offset += PINECONE_PAGE_SIZE) {
    const response = await index.fetch(ids.slice(offset, offset + PINECONE_PAGE_SIZE));
    Object.assign(records, response.records || {});
  }
  return records;
};

const loadChunkState = async ({ queryFn = query } = {}) => {
  const result = await queryFn(`
    SELECT chunk.document_id, chunk.chunk_index, chunk.vector_reference,
      chunk.embedding_namespace, chunk.embedding_input_sha256,
      chunk.original_text, chunk.translated_text,
      document.title, document.document_type, document.visibility_status,
      state.search_ready, state.semantic_ready, state.retrieval_verified,
      state.retry_eligible
    FROM document_text_chunks chunk
    JOIN documents document ON document.id = chunk.document_id
    LEFT JOIN document_processing_state state ON state.document_id = document.id
    ORDER BY chunk.document_id, chunk.chunk_index
  `);
  return result.rows;
};

const exactTextMatch = (row, record) => {
  const content = String(record?.metadata?.content || "").trim();
  if (!content) return false;
  return [row.original_text, row.translated_text]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .includes(content);
};

const summarizeByDocument = (items) => Object.values(items.reduce((summary, item) => {
  const key = String(item.documentId);
  const value = summary[key] || {
    documentId: key,
    title: item.title,
    documentType: item.documentType,
    count: 0,
  };
  value.count += 1;
  summary[key] = value;
  return summary;
}, {}));

const semanticReadinessTruth = (audit) => {
  const missingReferences = new Set(audit.missing.map((item) => item.vectorReference));
  const documents = Map.groupBy(audit.rows, (row) => String(row.document_id));
  const records = [];
  for (const [documentId, rows] of documents) {
    const first = rows[0];
    const derivedSemanticReady = Boolean(
      rows.length > 0 &&
      first.visibility_status === "public" &&
      first.search_ready &&
      first.retrieval_verified &&
      rows.every((row) => {
        const embeddingText = String(row.translated_text || row.original_text || "").trim();
        return Boolean(
          embeddingText &&
          row.embedding_namespace === audit.activeNamespace &&
          row.vector_reference &&
          !missingReferences.has(String(row.vector_reference)) &&
          row.embedding_input_sha256 === sha256(embeddingText)
        );
      })
    );
    records.push({
      documentId,
      title: first.title,
      documentType: first.document_type,
      flaggedSemanticReady: Boolean(first.semantic_ready),
      derivedSemanticReady,
      chunks: rows.length,
    });
  }
  const flaggedSemanticReady = records.filter((item) => item.flaggedSemanticReady).length;
  const derivedSemanticReady = records.filter((item) => item.derivedSemanticReady).length;
  const mismatches = records.filter((item) =>
    item.flaggedSemanticReady !== item.derivedSemanticReady);
  return {
    flaggedSemanticReady,
    derivedSemanticReady,
    difference: flaggedSemanticReady - derivedSemanticReady,
    mismatches,
  };
};

const summarizeSemanticReadinessTruth = (truth, sampleSize = 20) => ({
  flaggedSemanticReady: truth.flaggedSemanticReady,
  derivedSemanticReady: truth.derivedSemanticReady,
  difference: truth.difference,
  mismatchCount: truth.mismatches.length,
  mismatchSample: truth.mismatches.slice(0, sampleSize),
});

const reconcileSemanticReadinessTruth = async ({ audit, queryFn = query } = {}) => {
  const truth = semanticReadinessTruth(audit);
  if (!truth.mismatches.length) return { before: truth, updates: [] };
  const changes = truth.mismatches.map((item) => ({
    document_id: item.documentId,
    semantic_ready: item.derivedSemanticReady,
  }));
  const result = await queryFn(`
    WITH truth AS (
      SELECT document_id, semantic_ready
      FROM jsonb_to_recordset($1::jsonb)
        AS item(document_id BIGINT, semantic_ready BOOLEAN)
    )
    UPDATE document_processing_state AS state
    SET semantic_ready = truth.semantic_ready,
      capabilities_updated_at = NOW(), updated_at = NOW()
    FROM truth
    WHERE state.document_id = truth.document_id
      AND state.semantic_ready IS DISTINCT FROM truth.semantic_ready
    RETURNING state.document_id, state.semantic_ready
  `, [JSON.stringify(changes)]);
  const beforeByDocument = new Map(truth.mismatches.map((item) => [item.documentId, item]));
  const updates = result.rows.map((row) => ({
    documentId: String(row.document_id),
    before: beforeByDocument.get(String(row.document_id))?.flaggedSemanticReady,
    after: Boolean(row.semantic_ready),
  }));
  return { before: truth, updates };
};

const auditSemanticVectorState = async ({
  queryFn = query,
  indexes = { bill: getIndex(), act: getActIndex() },
  config = providerConfig(),
} = {}) => {
  const rows = await loadChunkState({ queryFn });
  const rowByReference = new Map(rows
    .filter((row) => row.vector_reference)
    .map((row) => [String(row.vector_reference), row]));
  const rowByIdentity = new Map(rows.map((row) => [
    `${row.document_id}:${row.chunk_index}`,
    row,
  ]));
  const documentChunkCounts = rows.reduce((counts, row) => {
    const key = String(row.document_id);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const [billIds, actIds] = await Promise.all([
    listVectorIds(indexes.bill),
    listVectorIds(indexes.act),
  ]);
  const idsByIndex = { bill: new Set(billIds), act: new Set(actIds) };
  const recordsByIndex = {
    bill: await fetchVectorRecords(indexes.bill, billIds),
    act: await fetchVectorRecords(indexes.act, actIds),
  };

  const activeRows = rows.filter((row) =>
    row.embedding_namespace === config.vectorNamespace && row.vector_reference);
  const missing = activeRows.filter((row) =>
    !idsByIndex[expectedIndexName(row.document_type)].has(String(row.vector_reference)))
    .map((row) => ({
      documentId: String(row.document_id),
      chunkIndex: Number(row.chunk_index),
      vectorReference: String(row.vector_reference),
      title: row.title,
      documentType: row.document_type,
      expectedIndex: expectedIndexName(row.document_type),
      hashPresent: Boolean(row.embedding_input_sha256),
    }));

  const vectorOnly = [];
  for (const [indexName, ids] of Object.entries(idsByIndex)) {
    for (const id of ids) {
      const current = rowByReference.get(id);
      if (current?.embedding_namespace === config.vectorNamespace &&
          expectedIndexName(current.document_type) === indexName) continue;
      const match = String(id).match(/^(?:bill|act|gazette|policy)-(\d+)-chunk-(\d+)$/);
      const row = match ? rowByIdentity.get(`${match[1]}:${Number(match[2])}`) : null;
      const record = recordsByIndex[indexName][id];
      vectorOnly.push({
        vectorReference: id,
        indexName,
        documentId: row ? String(row.document_id) : match?.[1] || null,
        chunkIndex: row ? Number(row.chunk_index) : Number(match?.[2]),
        title: row?.title || null,
        documentType: row?.document_type || null,
        exactIdentity: Boolean(row && row.vector_reference === id &&
          expectedIndexName(row.document_type) === indexName && exactTextMatch(row, record)),
        publicSearchReady: Boolean(row && row.visibility_status === "public" && row.search_ready),
        semanticReady: Boolean(row?.semantic_ready),
        retrievalVerified: Boolean(row?.retrieval_verified),
        currentNamespace: row?.embedding_namespace || null,
      });
    }
  }

  const exactCandidates = vectorOnly.filter((item) =>
    item.exactIdentity && item.publicSearchReady &&
    item.currentNamespace !== config.vectorNamespace);
  const candidateCounts = exactCandidates.reduce((counts, item) => {
    counts[item.documentId] = (counts[item.documentId] || 0) + 1;
    return counts;
  }, {});
  const reconcilableDocuments = new Set(Object.entries(candidateCounts)
    .filter(([documentId, count]) => count === documentChunkCounts[documentId])
    .map(([documentId]) => documentId));
  const metadataRepairs = exactCandidates.filter((item) =>
    reconcilableDocuments.has(item.documentId));
  const deferredVectorOnly = vectorOnly.filter((item) =>
    !metadataRepairs.some((candidate) => candidate.vectorReference === item.vectorReference));

  return {
    activeNamespace: config.vectorNamespace,
    postgresNamespaceReferences: activeRows.length,
    pinecone: { bill: billIds.length, act: actIds.length, total: billIds.length + actIds.length },
    missing,
    missingByDocument: summarizeByDocument(missing),
    metadataRepairs,
    metadataRepairsByDocument: summarizeByDocument(metadataRepairs),
    deferredVectorOnly,
    deferredByDocument: summarizeByDocument(deferredVectorOnly),
    rows,
  };
};

const repairSemanticVectorState = async ({
  audit,
  queryFn = query,
  processDocument = backfillSemanticDocument,
  config = providerConfig(),
  maxChunks = 100,
} = {}) => {
  const repairs = [];
  const metadataByDocument = Map.groupBy(
    audit.metadataRepairs,
    (item) => item.documentId,
  );
  const missingByDocument = Map.groupBy(
    audit.missing,
    (item) => item.documentId,
  );
  const rowByIdentity = new Map(audit.rows.map((row) => [
    `${row.document_id}:${row.chunk_index}`,
    row,
  ]));

  for (const [documentId, items] of metadataByDocument) {
    for (const item of items) {
      const row = rowByIdentity.get(`${documentId}:${item.chunkIndex}`);
      const embeddingText = String(row.translated_text || row.original_text || "").trim();
      await queryFn(`
        UPDATE document_text_chunks SET embedding_namespace = $3,
          embedding_input_sha256 = $4,
          metadata_json = metadata_json || jsonb_build_object(
            'embeddingProvider', $5::TEXT,
            'embeddingModel', $6::TEXT,
            'embeddingDimension', $7::TEXT,
            'vectorNamespace', $3::TEXT,
            'semanticReconciledAt', NOW()
          ), updated_at = NOW()
        WHERE document_id = $1 AND chunk_index = $2 AND vector_reference = $8
      `, [documentId, item.chunkIndex, config.vectorNamespace, sha256(embeddingText),
        config.embeddingProvider, config.embeddingModel,
        String(config.embeddingDimension), item.vectorReference]);
    }
    const row = rowByIdentity.get(`${documentId}:${items[0].chunkIndex}`);
    const result = await processDocument({
      document: {
        id: documentId,
        title: row.title,
        document_type: row.document_type,
        visibilityStatus: "public",
        searchReady: true,
        hasChunks: true,
        retryEligible: row.retry_eligible !== false,
        priorityTier: "P1",
        priorityScore: 0,
      },
      queryFn,
    });
    repairs.push({ documentId, kind: "metadata_reconciled", result });
  }

  for (const [documentId, items] of missingByDocument) {
    const rows = audit.rows.filter((row) => String(row.document_id) === documentId);
    if (!rows.length || rows.length > maxChunks || items.some((item) => !item.hashPresent)) {
      repairs.push({ documentId, kind: "missing_vector_deferred", reason: "unsafe_or_oversized" });
      continue;
    }
    const row = rows[0];
    if (row.visibility_status !== "public" || !row.search_ready) {
      repairs.push({ documentId, kind: "missing_vector_deferred", reason: "not_public_search_ready" });
      continue;
    }
    const result = await processDocument({
      document: {
        id: documentId,
        title: row.title,
        document_type: row.document_type,
        visibilityStatus: row.visibility_status,
        searchReady: Boolean(row.search_ready),
        hasChunks: true,
        retryEligible: row.retry_eligible !== false,
        priorityTier: "P1",
        priorityScore: 0,
      },
      queryFn,
      missingVectorIds: new Set(items.map((item) => item.vectorReference)),
    });
    repairs.push({ documentId, kind: "missing_vectors_rebuilt", result });
  }
  return repairs;
};

module.exports = {
  auditSemanticVectorState,
  exactTextMatch,
  expectedIndexName,
  fetchVectorRecords,
  listVectorIds,
  repairSemanticVectorState,
  reconcileSemanticReadinessTruth,
  semanticReadinessTruth,
  summarizeSemanticReadinessTruth,
  summarizeByDocument,
};
