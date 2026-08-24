const crypto = require("node:crypto");
const { getPool, query } = require("../db");

const STRUCTURE_INDEX_VERSION = "document-tree-v1";
const hash = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const clean = (value, maximum = 1_000) => String(value || "")
  .normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maximum);
const nodeId = (path) => `node-${hash(path.join(" > ")).slice(0, 20)}`;

const validStructuralTitle = (value) => {
  const title = clean(value, 240);
  if (title.length < 4) return false;
  if (/^\(?[ivxlcdm0-9a-z]{1,6}\)?[.)-]?$/i.test(title)) return false;
  if (/^(?:part|section|article|rule|chapter|clause)\s+(?:of|any|the)?$/i.test(title)) return false;
  if (/^(?:part|section|article|rule|chapter|clause)\s+of\b/i.test(title)) return false;
  if (/^(?:part|chapter|schedule|section|article|rule|clause)\s+[0-9ivxlcdm]+(?:\([a-z0-9]+\))*\b/i.test(title)) return true;
  const words = title.match(/[\p{L}]{3,}/gu) || [];
  return title.length <= 160 && words.length >= 2;
};

const structurePath = (row) => {
  const metadata = row.metadata_json || {};
  const declared = Array.isArray(metadata.sectionPath)
    ? metadata.sectionPath.map((item) => clean(item, 240)).filter(validStructuralTitle)
    : [];
  if (declared.length) return declared;
  const labels = [metadata.partTitle, metadata.chapterTitle,
    metadata.sectionTitle || metadata.sectionId, metadata.clauseId]
    .map((item) => clean(item, 240)).filter(validStructuralTitle);
  return [...new Set(labels)];
};

const inferNodeType = (title, depth, isLeaf) => {
  const value = clean(title).toLowerCase();
  if (/\bpart\b/.test(value)) return "part";
  if (/\bchapter\b/.test(value)) return "chapter";
  if (/\bschedule\b/.test(value)) return "schedule";
  if (/\b(section|article|rule)\b/.test(value)) return "section";
  if (/\bclause\b/.test(value)) return "clause";
  return isLeaf ? "passage_group" : depth === 1 ? "division" : "section";
};

const buildDocumentTree = ({ document, chunks, maximumNodes = 240 }) => {
  const rootId = `document-${document.id}`;
  const nodes = new Map([[rootId, {
    nodeId: rootId, parentNodeId: null, title: clean(document.title, 300),
    nodeType: "document", pageStart: null, pageEnd: null,
    childIds: [], sourceChunkIds: [], excerpts: [],
  }]]);
  const fallbackSize = 12;
  for (const row of chunks) {
    let path = structurePath(row);
    if (!path.length) path = [`Passages ${Math.floor(Number(row.chunk_index) / fallbackSize) * fallbackSize + 1}–${Math.floor(Number(row.chunk_index) / fallbackSize) * fallbackSize + fallbackSize}`];
    let parentId = rootId;
    const accumulated = [];
    path.slice(0, 8).forEach((title, depth) => {
      accumulated.push(title);
      const id = nodeId([String(document.id), ...accumulated]);
      if (!nodes.has(id) && nodes.size < maximumNodes) {
        nodes.set(id, {
          nodeId: id, parentNodeId: parentId, title,
          nodeType: inferNodeType(title, depth + 1, depth === path.length - 1),
          pageStart: null, pageEnd: null, childIds: [], sourceChunkIds: [], excerpts: [],
        });
        const parent = nodes.get(parentId);
        if (parent && !parent.childIds.includes(id)) parent.childIds.push(id);
      }
      if (nodes.has(id)) parentId = id;
    });
    const leaf = nodes.get(parentId) || nodes.get(rootId);
    const chunkIndex = Number(row.chunk_index);
    leaf.sourceChunkIds.push(chunkIndex);
    const metadata = row.metadata_json || {};
    const pageStart = Number(metadata.pageStart || 0) || null;
    const pageEnd = Number(metadata.pageEnd || 0) || pageStart;
    if (pageStart) leaf.pageStart = leaf.pageStart == null ? pageStart : Math.min(leaf.pageStart, pageStart);
    if (pageEnd) leaf.pageEnd = leaf.pageEnd == null ? pageEnd : Math.max(leaf.pageEnd, pageEnd);
    if (leaf.excerpts.length < 2) leaf.excerpts.push(clean(row.original_text || row.translated_text, 500));
  }
  const ordered = [...nodes.values()].reverse();
  for (const current of ordered) {
    const children = current.childIds.map((id) => nodes.get(id)).filter(Boolean);
    for (const child of children) {
      current.sourceChunkIds.push(...child.sourceChunkIds);
      if (child.pageStart) current.pageStart = current.pageStart == null ? child.pageStart : Math.min(current.pageStart, child.pageStart);
      if (child.pageEnd) current.pageEnd = current.pageEnd == null ? child.pageEnd : Math.max(current.pageEnd, child.pageEnd);
      if (current.excerpts.length < 2 && child.summary) current.excerpts.push(child.summary);
    }
    current.sourceChunkIds = [...new Set(current.sourceChunkIds)].slice(0, 2_000);
    current.summary = current.excerpts.filter(Boolean).join(" ").slice(0, 1_000);
    current.contentHash = hash([current.title, current.summary, ...current.sourceChunkIds].join("|"));
    delete current.excerpts;
  }
  return [...nodes.values()];
};

const loadTreeInput = async (documentId, queryFn = query) => {
  const [documentResult, chunksResult] = await Promise.all([
    queryFn(`SELECT document.id, document.title, document.document_type,
        document.content_fingerprint_sha256, document.visibility_status,
        state.search_ready
      FROM documents document
      JOIN document_processing_state state ON state.document_id = document.id
      WHERE document.id = $1`, [documentId]),
    queryFn(`SELECT chunk_index, original_text, translated_text, metadata_json
      FROM document_text_chunks WHERE document_id = $1 ORDER BY chunk_index LIMIT 2001`, [documentId]),
  ]);
  const document = documentResult.rows[0];
  if (!document || document.visibility_status !== "public" || !document.search_ready) {
    throw new Error("Document-tree indexing requires a public search-ready document.");
  }
  if (!chunksResult.rows.length) throw new Error("No source chunks are available for tree indexing.");
  if (chunksResult.rows.length > 2_000) throw new Error("Documents above 2,000 chunks require operator review.");
  return { document, chunks: chunksResult.rows };
};

const persistDocumentTree = async ({ document, nodes }) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM document_structure_nodes WHERE document_id = $1", [document.id]);
    await client.query(`INSERT INTO document_structure_nodes (
        document_id, node_id, parent_node_id, title, node_type, summary,
        page_start, page_end, child_ids_json, source_chunk_ids_json,
        content_hash, index_version
      )
      SELECT $1, payload.node_id, payload.parent_node_id, payload.title,
        payload.node_type, payload.summary, payload.page_start, payload.page_end,
        payload.child_ids_json, payload.source_chunk_ids_json,
        payload.content_hash, $3
      FROM JSONB_TO_RECORDSET($2::jsonb) AS payload(
        node_id TEXT, parent_node_id TEXT, title TEXT, node_type TEXT,
        summary TEXT, page_start INTEGER, page_end INTEGER,
        child_ids_json JSONB, source_chunk_ids_json JSONB, content_hash TEXT
      )`, [document.id, JSON.stringify(nodes.map((node) => ({
      node_id: node.nodeId,
      parent_node_id: node.parentNodeId,
      title: node.title,
      node_type: node.nodeType,
      summary: node.summary,
      page_start: node.pageStart,
      page_end: node.pageEnd,
      child_ids_json: node.childIds,
      source_chunk_ids_json: node.sourceChunkIds,
      content_hash: node.contentHash,
    }))), STRUCTURE_INDEX_VERSION]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const indexDocumentTree = async ({ documentId, dryRun = false, queryFn = query } = {}) => {
  const startedAt = Date.now();
  const { document, chunks } = await loadTreeInput(documentId, queryFn);
  const nodes = buildDocumentTree({ document, chunks });
  const result = {
    documentId: String(document.id), chunkCount: chunks.length,
    nodeCount: nodes.length, structuredNodeCount: nodes.filter((node) => node.nodeType !== "passage_group").length,
    indexVersion: STRUCTURE_INDEX_VERSION, durationMs: Date.now() - startedAt,
  };
  if (dryRun) return { ...result, status: "dry_run", nodes };
  await persistDocumentTree({ document, nodes });
  return { ...result, status: "indexed" };
};

const queryTokens = (value) => [...new Set(clean(value, 2_000).toLowerCase()
  .replace(/[^\p{L}\p{N}\s]+/gu, " ").split(/\s+/u)
  .filter((token) => token.length >= 3))].slice(0, 20);

const retrieveTreePassages = async (documentId, message, limit = 24, queryFn = query) => {
  const tokens = queryTokens(message);
  if (!tokens.length) return [];
  const nodes = await queryFn(`SELECT node_id, title, summary, source_chunk_ids_json
    FROM document_structure_nodes
    WHERE document_id = $1 AND JSONB_ARRAY_LENGTH(source_chunk_ids_json) > 0`, [documentId]);
  const ranked = nodes.rows.map((node) => {
    const haystack = `${node.title} ${node.summary}`.toLowerCase();
    const score = tokens.filter((token) => haystack.includes(token)).length / tokens.length;
    return { ...node, score };
  }).filter((node) => node.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  const chunkIndexes = [...new Set(ranked.flatMap((node) => node.source_chunk_ids_json || []))].slice(0, 160);
  if (!chunkIndexes.length) return [];
  const chunks = await queryFn(`SELECT chunk_index, original_text, translated_text,
      language, metadata_json
    FROM document_text_chunks
    WHERE document_id = $1 AND chunk_index = ANY($2::INTEGER[])
    ORDER BY chunk_index`, [documentId, chunkIndexes]);
  return chunks.rows.map((row) => {
    const metadata = row.metadata_json || {};
    const content = clean(row.original_text || row.translated_text, 4_000);
    const score = tokens.filter((token) => content.toLowerCase().includes(token)).length / tokens.length;
    return {
      content, score, treeScore: score, chunkIndex: Number(row.chunk_index),
      languageCode: metadata.languageCode || row.language || "und",
      pageStart: metadata.pageStart || null, pageEnd: metadata.pageEnd || null,
      pageEstimate: Boolean(metadata.pageEstimate), sectionId: metadata.sectionId || null,
      sectionTitle: metadata.sectionTitle || null, clauseId: metadata.clauseId || null,
      structuralType: metadata.structuralType || "passage", source: metadata.source || "Indexed document text",
      sourceUrl: metadata.sourceUrl || null, pdfUrl: metadata.pdfUrl || null,
      resourceType: metadata.resourceType || null, retrievalMode: "hierarchical_tree",
      rankingReasons: ["document_tree_branch"],
    };
  }).filter((passage) => passage.content).sort((a, b) => b.score - a.score).slice(0, limit);
};

module.exports = {
  STRUCTURE_INDEX_VERSION,
  buildDocumentTree,
  indexDocumentTree,
  persistDocumentTree,
  retrieveTreePassages,
  structurePath,
  validStructuralTitle,
};
