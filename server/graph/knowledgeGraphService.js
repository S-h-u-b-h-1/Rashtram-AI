const { query } = require("../db");

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, minimum), maximum)
    : fallback;
};

const normalizeId = (value, label = "Document ID") => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    const error = new Error(`${label} must be a positive integer.`);
    error.status = 400;
    throw error;
  }
  return parsed;
};

const normalizeRelationshipType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z_]{2,60}$/.test(normalized)) {
    const error = new Error("Invalid relationship type.");
    error.status = 400;
    throw error;
  }
  return normalized;
};

const documentNode = (row, prefix = "") => ({
  id: `document:${row[`${prefix}id`]}`,
  documentId: String(row[`${prefix}id`]),
  kind: row[`${prefix}document_type`] || "document",
  label: row[`${prefix}title`],
  document: {
    id: String(row[`${prefix}id`]),
    title: row[`${prefix}title`],
    type: row[`${prefix}document_type`],
    documentType: row[`${prefix}document_type`],
    ministry: row[`${prefix}ministry`],
    authority: row[`${prefix}authority`],
    jurisdiction: row[`${prefix}jurisdiction`],
    state: row[`${prefix}state`],
    year: row[`${prefix}year`],
    publicationDate: row[`${prefix}publication_date`],
    introducedDate: row[`${prefix}introduced_date`] || null,
    enactedDate: row[`${prefix}enacted_date`] || null,
    effectiveDate: row[`${prefix}effective_date`] || null,
    sourceUrl: row[`${prefix}canonical_url`],
    pdfUrl: row[`${prefix}pdf_url`] || null,
    hasAccessibleResource: Boolean(
      row[`${prefix}pdf_url`] || row[`${prefix}canonical_url`],
    ),
    researchReady: Boolean(row[`${prefix}research_ready`]),
  },
});

const edgeFromRow = (row) => ({
  id: String(row.relationship_id || row.id),
  from: `document:${row.from_document_id}`,
  to: `document:${row.to_document_id}`,
  sourceDocumentId: String(row.from_document_id),
  targetDocumentId: String(row.to_document_id),
  type: row.relationship_type,
  label: String(row.relationship_type || "").replaceAll("_", " "),
  confidence:
    row.confidence == null ? null : Number(row.confidence),
  strength:
    row.relationship_strength == null
      ? row.confidence == null
        ? null
        : Number(row.confidence)
      : Number(row.relationship_strength),
  relationshipSource:
    row.relationship_source || row.source_name || "catalogue",
  explanation: row.explanation || null,
  evidence: row.relationship_evidence || row.metadata_json || {},
  sourceUrl: row.source_url || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getRelationships = async (documentId, options = {}) => {
  const id = normalizeId(documentId);
  const limit = clampInteger(options.limit, 50, 1, 100);
  const offset = clampInteger(options.offset, 0, 0, 10_000);
  const type = normalizeRelationshipType(options.type);
  const minimumConfidence = Math.min(
    Math.max(Number(options.minimumConfidence || 0), 0),
    1,
  );
  const result = await query(
    `SELECT
       relationship.id AS relationship_id,
       relationship.from_document_id,
       relationship.to_document_id,
       relationship.relationship_type,
       relationship.relationship_strength,
       relationship.relationship_source,
       relationship.confidence,
       relationship.explanation,
       relationship.relationship_evidence,
       relationship.source_name,
       relationship.source_url,
       relationship.metadata_json,
       relationship.created_at,
       relationship.updated_at,
       related.id AS related_id,
       related.title AS related_title,
       related.document_type AS related_document_type,
       related.ministry AS related_ministry,
       related.authority AS related_authority,
       related.jurisdiction AS related_jurisdiction,
       schema_document.state AS related_state,
       related.year AS related_year,
       related.publication_date AS related_publication_date,
       related.introduced_date AS related_introduced_date,
       related.enacted_date AS related_enacted_date,
       related.effective_date AS related_effective_date,
       related.pdf_url AS related_pdf_url,
       COALESCE(
         schema_document.canonical_url,
         related.detail_url,
         related.source_url
       ) AS related_canonical_url,
       schema_document.research_ready AS related_research_ready,
       COUNT(*) OVER()::INTEGER AS total_count
     FROM document_relationships relationship
     JOIN legislative_documents related
       ON related.id = CASE
         WHEN relationship.from_document_id = $1
         THEN relationship.to_document_id
         ELSE relationship.from_document_id
       END
     LEFT JOIN documents schema_document ON schema_document.id = related.id
     WHERE (
       relationship.from_document_id = $1
       OR relationship.to_document_id = $1
     )
       AND ($2::TEXT IS NULL OR relationship.relationship_type = $2)
       AND COALESCE(relationship.confidence, 0) >= $3
       AND COALESCE(schema_document.visibility_status, 'public') = 'public'
     ORDER BY
       COALESCE(
         relationship.relationship_strength,
         relationship.confidence,
         0
       ) DESC,
       relationship.updated_at DESC
     LIMIT $4 OFFSET $5`,
    [id, type, minimumConfidence, limit, offset],
  );
  return {
    documentId: String(id),
    relationships: result.rows.map((row) => ({
      ...edgeFromRow(row),
      direction:
        Number(row.from_document_id) === id ? "outgoing" : "incoming",
      document: documentNode(row, "related_").document,
    })),
    pagination: {
      limit,
      offset,
      total: Number(result.rows[0]?.total_count || 0),
    },
  };
};

const getGraph = async (documentId, options = {}) => {
  const id = normalizeId(documentId);
  const depth = clampInteger(options.depth, 1, 1, 3);
  const limit = clampInteger(options.limit, 80, 5, 200);
  const result = await query(
    `WITH RECURSIVE walk(document_id, depth) AS (
       SELECT $1::BIGINT, 0
       UNION
       SELECT
         CASE
           WHEN relationship.from_document_id = walk.document_id
           THEN relationship.to_document_id
           ELSE relationship.from_document_id
         END,
         walk.depth + 1
       FROM walk
       JOIN LATERAL (
         SELECT candidate.*
         FROM document_relationships candidate
         WHERE (
           candidate.from_document_id = walk.document_id
           OR candidate.to_document_id = walk.document_id
         )
           AND COALESCE(candidate.confidence, 0) >= 0.35
         ORDER BY COALESCE(
           candidate.relationship_strength,
           candidate.confidence,
           0
         ) DESC
         LIMIT 40
       ) relationship ON TRUE
       WHERE walk.depth < $2
     ),
     node_ids AS (
       SELECT DISTINCT document_id FROM walk LIMIT $3
     )
     SELECT
       relationship.id AS relationship_id,
       relationship.from_document_id,
       relationship.to_document_id,
       relationship.relationship_type,
       relationship.relationship_strength,
       relationship.relationship_source,
       relationship.confidence,
       relationship.explanation,
       relationship.relationship_evidence,
       relationship.source_name,
       relationship.source_url,
       relationship.metadata_json,
       relationship.created_at,
       relationship.updated_at,
       source.id AS source_id,
       source.title AS source_title,
       source.document_type AS source_document_type,
       source.ministry AS source_ministry,
       source.authority AS source_authority,
       source.jurisdiction AS source_jurisdiction,
       source_schema.state AS source_state,
       source.year AS source_year,
       source.publication_date AS source_publication_date,
       source.introduced_date AS source_introduced_date,
       source.enacted_date AS source_enacted_date,
       source.effective_date AS source_effective_date,
       source.pdf_url AS source_pdf_url,
       COALESCE(
         source_schema.canonical_url,
         source.detail_url,
         source.source_url
       ) AS source_canonical_url,
       source_schema.research_ready AS source_research_ready,
       target.id AS target_id,
       target.title AS target_title,
       target.document_type AS target_document_type,
       target.ministry AS target_ministry,
       target.authority AS target_authority,
       target.jurisdiction AS target_jurisdiction,
       target_schema.state AS target_state,
       target.year AS target_year,
       target.publication_date AS target_publication_date,
       target.introduced_date AS target_introduced_date,
       target.enacted_date AS target_enacted_date,
       target.effective_date AS target_effective_date,
       target.pdf_url AS target_pdf_url,
       COALESCE(
         target_schema.canonical_url,
         target.detail_url,
         target.source_url
       ) AS target_canonical_url,
       target_schema.research_ready AS target_research_ready
     FROM document_relationships relationship
     JOIN node_ids source_node
       ON source_node.document_id = relationship.from_document_id
     JOIN node_ids target_node
       ON target_node.document_id = relationship.to_document_id
     JOIN legislative_documents source
       ON source.id = relationship.from_document_id
     JOIN legislative_documents target
       ON target.id = relationship.to_document_id
     LEFT JOIN documents source_schema ON source_schema.id = source.id
     LEFT JOIN documents target_schema ON target_schema.id = target.id
     WHERE COALESCE(source_schema.visibility_status, 'public') = 'public'
       AND COALESCE(target_schema.visibility_status, 'public') = 'public'
     ORDER BY
       COALESCE(
         relationship.relationship_strength,
         relationship.confidence,
         0
       ) DESC
     LIMIT $3`,
    [id, depth, limit],
  );
  const nodes = new Map();
  const edges = result.rows.map((row) => {
    const source = documentNode(row, "source_");
    const target = documentNode(row, "target_");
    nodes.set(source.id, source);
    nodes.set(target.id, target);
    return edgeFromRow(row);
  });
  if (!nodes.has(`document:${id}`)) {
    const root = await query(
      `SELECT legacy.id, legacy.title, legacy.document_type,
         legacy.ministry, legacy.authority, legacy.jurisdiction,
         schema_document.state, legacy.year, legacy.publication_date,
         legacy.introduced_date, legacy.enacted_date, legacy.effective_date,
         legacy.pdf_url,
         COALESCE(
           schema_document.canonical_url,
           legacy.detail_url,
           legacy.source_url
         ) AS canonical_url,
         schema_document.research_ready
       FROM legislative_documents legacy
       LEFT JOIN documents schema_document ON schema_document.id = legacy.id
       WHERE legacy.id = $1`,
      [id],
    );
    if (!root.rows[0]) {
      const error = new Error("Document not found.");
      error.status = 404;
      throw error;
    }
    nodes.set(`document:${id}`, documentNode(root.rows[0]));
  }

  const rootNode = nodes.get(`document:${id}`);
  for (const [kind, label] of [
    ["ministry", rootNode.document.ministry],
    ["authority", rootNode.document.authority],
    ["jurisdiction", rootNode.document.state || rootNode.document.jurisdiction],
  ]) {
    if (!label) continue;
    const entityId = `${kind}:${label}`;
    nodes.set(entityId, { id: entityId, kind, label, entity: true });
    edges.push({
      id: `virtual:${id}:${kind}`,
      from: `document:${id}`,
      to: entityId,
      type: kind === "authority" || kind === "ministry"
        ? "ISSUED_BY"
        : "GOVERNED_BY",
      label: kind === "jurisdiction" ? "GOVERNED BY" : "ISSUED BY",
      confidence: 1,
      strength: 1,
      relationshipSource: "canonical_metadata",
      explanation: `${rootNode.label} is catalogued under ${label}.`,
      evidence: { field: kind, value: label },
      virtual: true,
    });
  }
  return {
    rootId: `document:${id}`,
    currentDocument: rootNode.document,
    nodes: [...nodes.values()],
    edges,
    depth,
    truncated: edges.length >= limit,
  };
};

const searchGraph = async (search, options = {}) => {
  const text = String(search || "").normalize("NFKC").trim();
  if (text.length < 2 || text.length > 300) {
    const error = new Error("Graph search requires 2 to 300 characters.");
    error.status = 400;
    throw error;
  }
  const limit = clampInteger(options.limit, 20, 1, 50);
  const type = String(options.type || "").trim().toLowerCase() || null;
  const result = await query(
    `SELECT legacy.id, legacy.title, legacy.document_type,
       legacy.ministry, legacy.authority, legacy.jurisdiction,
       schema_document.state, legacy.year, legacy.publication_date,
       legacy.introduced_date, legacy.enacted_date, legacy.effective_date,
       legacy.pdf_url,
       schema_document.canonical_url,
       schema_document.research_ready,
       COUNT(relationship.id)::INTEGER AS relationship_count
     FROM legislative_documents legacy
     JOIN documents schema_document ON schema_document.id = legacy.id
     LEFT JOIN document_relationships relationship ON (
       relationship.from_document_id = legacy.id
       OR relationship.to_document_id = legacy.id
     )
     WHERE schema_document.visibility_status = 'public'
       AND ($2::TEXT IS NULL OR legacy.document_type = $2)
       AND (
         legacy.title ILIKE '%' || $1 || '%'
         OR legacy.legal_identifier ILIKE '%' || $1 || '%'
         OR legacy.ministry ILIKE '%' || $1 || '%'
         OR legacy.authority ILIKE '%' || $1 || '%'
       )
     GROUP BY legacy.id, schema_document.id
     ORDER BY relationship_count DESC,
       schema_document.quality_score DESC,
       legacy.updated_at DESC
     LIMIT $3`,
    [text, type, limit],
  );
  return {
    query: text,
    nodes: result.rows.map((row) => ({
      ...documentNode(row),
      relationshipCount: Number(row.relationship_count || 0),
    })),
  };
};

const findPath = async (sourceValue, targetValue, options = {}) => {
  const sourceId = normalizeId(sourceValue, "Source document ID");
  const targetId = normalizeId(targetValue, "Target document ID");
  const maxDepth = clampInteger(options.maxDepth, 6, 1, 8);
  if (sourceId === targetId) {
    return getGraph(sourceId, { depth: 1, limit: 10 }).then((graph) => ({
      sourceDocumentId: String(sourceId),
      targetDocumentId: String(targetId),
      found: true,
      nodes: graph.nodes.filter((node) => node.id === graph.rootId),
      edges: [],
      length: 0,
    }));
  }
  const pathResult = await query(
    `WITH RECURSIVE paths(
       current_id,
       node_path,
       edge_path,
       depth
     ) AS (
       SELECT $1::BIGINT, ARRAY[$1::BIGINT], ARRAY[]::BIGINT[], 0
       UNION ALL
       SELECT
         CASE
           WHEN relationship.from_document_id = paths.current_id
           THEN relationship.to_document_id
           ELSE relationship.from_document_id
         END,
         paths.node_path || CASE
           WHEN relationship.from_document_id = paths.current_id
           THEN relationship.to_document_id
           ELSE relationship.from_document_id
         END,
         paths.edge_path || relationship.id,
         paths.depth + 1
       FROM paths
       JOIN LATERAL (
         SELECT candidate.*
         FROM document_relationships candidate
         WHERE (
           candidate.from_document_id = paths.current_id
           OR candidate.to_document_id = paths.current_id
         )
           AND COALESCE(candidate.confidence, 0) >= 0.35
         ORDER BY COALESCE(
           candidate.relationship_strength,
           candidate.confidence,
           0
         ) DESC
         LIMIT 40
       ) relationship ON TRUE
       WHERE paths.depth < $3
         AND NOT (
           CASE
             WHEN relationship.from_document_id = paths.current_id
             THEN relationship.to_document_id
             ELSE relationship.from_document_id
           END = ANY(paths.node_path)
         )
     )
     SELECT node_path, edge_path, depth
     FROM paths
     WHERE current_id = $2
     ORDER BY depth ASC
     LIMIT 1`,
    [sourceId, targetId, maxDepth],
  );
  const found = pathResult.rows[0];
  if (!found) {
    return {
      sourceDocumentId: String(sourceId),
      targetDocumentId: String(targetId),
      found: false,
      nodes: [],
      edges: [],
      length: null,
    };
  }
  const [nodesResult, edgesResult] = await Promise.all([
    query(
      `SELECT legacy.id, legacy.title, legacy.document_type,
         legacy.ministry, legacy.authority, legacy.jurisdiction,
         schema_document.state, legacy.year, legacy.publication_date,
         legacy.introduced_date, legacy.enacted_date, legacy.effective_date,
         legacy.pdf_url,
         schema_document.canonical_url,
         schema_document.research_ready
       FROM UNNEST($1::BIGINT[]) WITH ORDINALITY requested(id, position)
       JOIN legislative_documents legacy ON legacy.id = requested.id
       LEFT JOIN documents schema_document ON schema_document.id = legacy.id
       ORDER BY requested.position`,
      [found.node_path],
    ),
    query(
      `SELECT relationship.id AS relationship_id, relationship.*
       FROM UNNEST($1::BIGINT[]) WITH ORDINALITY requested(id, position)
       JOIN document_relationships relationship ON relationship.id = requested.id
       ORDER BY requested.position`,
      [found.edge_path],
    ),
  ]);
  return {
    sourceDocumentId: String(sourceId),
    targetDocumentId: String(targetId),
    found: true,
    nodes: nodesResult.rows.map((row) => documentNode(row)),
    edges: edgesResult.rows.map(edgeFromRow),
    length: Number(found.depth),
  };
};

const saveGraphPath = async (userId, sourceId, targetId, title) => {
  const path = await findPath(sourceId, targetId);
  if (!path.found) {
    const error = new Error("No supported relationship path was found.");
    error.status = 404;
    throw error;
  }
  const result = await query(
    `INSERT INTO saved_graph_paths (
       user_id, source_document_id, target_document_id, path_json, title
     )
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (user_id, source_document_id, target_document_id)
     DO UPDATE SET
       path_json = EXCLUDED.path_json,
       title = COALESCE(EXCLUDED.title, saved_graph_paths.title),
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      normalizeId(sourceId),
      normalizeId(targetId),
      JSON.stringify(path),
      String(title || "").trim().slice(0, 300) || null,
    ],
  );
  return {
    id: String(result.rows[0].id),
    title: result.rows[0].title,
    path,
    createdAt: result.rows[0].created_at,
    updatedAt: result.rows[0].updated_at,
  };
};

const getKnowledgeGraphMetrics = async () => {
  const result = await query(`
    SELECT
      (SELECT COUNT(*)::INTEGER FROM documents
       WHERE visibility_status = 'public') AS total_documents,
      (
        SELECT COUNT(DISTINCT connected.document_id)::INTEGER
        FROM (
          SELECT from_document_id AS document_id FROM document_relationships
          UNION
          SELECT to_document_id AS document_id FROM document_relationships
        ) connected
      ) AS connected_documents,
      (SELECT COUNT(*)::INTEGER FROM document_relationships)
        AS relationships,
      (
        SELECT COUNT(*)::INTEGER FROM document_relationships
        WHERE created_at >= NOW() - INTERVAL '30 days'
      ) AS new_relationships,
      (
        SELECT COUNT(*)::INTEGER FROM document_relationships
        WHERE relationship_type IN ('AMENDS', 'AMENDED_BY')
      ) AS amendment_relationships
  `);
  const [ministries, amendedActs] = await Promise.all([
    query(`
      SELECT document.ministry, COUNT(relationship.id)::INTEGER AS relationships
      FROM legislative_documents document
      JOIN document_relationships relationship ON (
        relationship.from_document_id = document.id
        OR relationship.to_document_id = document.id
      )
      WHERE document.ministry IS NOT NULL AND document.ministry <> ''
      GROUP BY document.ministry
      ORDER BY relationships DESC, document.ministry
      LIMIT 6
    `),
    query(`
      SELECT document.id, document.title,
        COUNT(relationship.id)::INTEGER AS amendment_count
      FROM legislative_documents document
      JOIN document_relationships relationship ON (
        relationship.to_document_id = document.id
        AND relationship.relationship_type IN ('AMENDS', 'AMENDED_BY')
      )
      WHERE document.document_type = 'act'
      GROUP BY document.id
      ORDER BY amendment_count DESC, document.title
      LIMIT 6
    `),
  ]);
  const row = result.rows[0] || {};
  const totalDocuments = Number(row.total_documents || 0);
  const connectedDocuments = Number(row.connected_documents || 0);
  return {
    totalDocuments,
    connectedDocuments,
    unconnectedDocuments: Math.max(totalDocuments - connectedDocuments, 0),
    relationships: Number(row.relationships || 0),
    newRelationships: Number(row.new_relationships || 0),
    amendmentRelationships: Number(row.amendment_relationships || 0),
    coveragePercent:
      totalDocuments > 0
        ? Number(((connectedDocuments / totalDocuments) * 100).toFixed(1))
        : 0,
    topConnectedMinistries: ministries.rows.map((item) => ({
      ministry: item.ministry,
      relationships: Number(item.relationships || 0),
    })),
    mostAmendedActs: amendedActs.rows.map((item) => ({
      id: String(item.id),
      title: item.title,
      amendmentCount: Number(item.amendment_count || 0),
    })),
  };
};

const getRelationshipContext = async (documentId, question, limit = 12) => {
  if (
    !/(relat|amend|replace|repeal|implement|notif|under|issued|similar|equivalent|govern|clarif)/i
      .test(String(question || ""))
  ) {
    return { context: "", sources: [], graphGrounded: false };
  }
  const { relationships } = await getRelationships(documentId, {
    limit,
    minimumConfidence: 0.35,
  });
  const context = relationships.map((relationship, index) =>
    [
      `[GRAPH-${index + 1}]`,
      `Relationship: ${relationship.relationshipType}`,
      `Direction: ${relationship.direction}`,
      `Related document: ${relationship.document.title}`,
      `Type: ${relationship.document.documentType}`,
      `Confidence: ${relationship.confidence ?? "not scored"}`,
      relationship.explanation
        ? `Explanation: ${relationship.explanation}`
        : "",
    ].filter(Boolean).join("\n"),
  ).join("\n\n");
  return {
    context,
    graphGrounded: relationships.length > 0,
    sources: relationships.map((relationship, index) => ({
      passage: `GRAPH-${index + 1}`,
      content:
        relationship.explanation ||
        `${relationship.relationshipType}: ${relationship.document.title}`,
      documentId: relationship.document.id,
      documentTitle: relationship.document.title,
      sourceUrl:
        relationship.sourceUrl || relationship.document.sourceUrl,
      relationshipType: relationship.relationshipType,
      confidence: relationship.confidence,
      graphSource: true,
    })),
  };
};

const getComparisonGraphOverlap = async (documentIds) => {
  const ids = [...new Set(documentIds.map((id) => normalizeId(id)))];
  const result = await query(
    `SELECT relationship.id AS relationship_id, relationship.*,
       source.title AS source_title,
       target.title AS target_title
     FROM document_relationships relationship
     JOIN legislative_documents source
       ON source.id = relationship.from_document_id
     JOIN legislative_documents target
       ON target.id = relationship.to_document_id
     WHERE relationship.from_document_id = ANY($1::BIGINT[])
       AND relationship.to_document_id = ANY($1::BIGINT[])
     ORDER BY COALESCE(
       relationship.relationship_strength,
       relationship.confidence,
       0
     ) DESC`,
    [ids],
  );
  const metadata = await query(
    `SELECT id, ministry, authority, jurisdiction, category,
       publication_date, enacted_date, effective_date
     FROM legislative_documents
     WHERE id = ANY($1::BIGINT[])`,
    [ids],
  );
  const sharedValues = (field) => {
    const counts = new Map();
    for (const row of metadata.rows) {
      const value = row[field];
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([value]) => value);
  };
  return {
    relationships: result.rows.map((row) => ({
      ...edgeFromRow(row),
      sourceTitle: row.source_title,
      targetTitle: row.target_title,
    })),
    sharedMinistries: sharedValues("ministry"),
    sharedAuthorities: sharedValues("authority"),
    sharedJurisdictions: sharedValues("jurisdiction"),
    sharedTopics: sharedValues("category"),
  };
};

const getGraphProfileInsights = async (userId) => {
  const [journeys, paths] = await Promise.all([
    query(
      `SELECT
         COALESCE(document.ministry, document.authority) AS ministry,
         document.category AS topic,
         activity.document_id,
         document.title,
         COUNT(*)::INTEGER AS explorations
       FROM user_activity_events activity
       LEFT JOIN legislative_documents document
         ON document.id = activity.document_id
       WHERE activity.user_id = $1
         AND activity.event_type IN (
           'graph_viewed',
           'graph_node_opened',
           'graph_path_searched'
         )
       GROUP BY
         COALESCE(document.ministry, document.authority),
         document.category,
         activity.document_id,
         document.title
       ORDER BY explorations DESC
       LIMIT 20`,
      [userId],
    ),
    query(
      `SELECT id, title, source_document_id, target_document_id,
         path_json, created_at, updated_at
       FROM saved_graph_paths
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [userId],
    ),
  ]);
  const top = (field) => [
    ...journeys.rows.reduce((counts, row) => {
      const value = row[field];
      if (value) counts.set(value, (counts.get(value) || 0) + row.explorations);
      return counts;
    }, new Map()).entries(),
  ]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label, explorations]) => ({ label, explorations }));
  return {
    mostExploredMinistries: top("ministry"),
    mostExploredTopics: top("topic"),
    mostExploredNodes: journeys.rows.slice(0, 8).map((row) => ({
      documentId: row.document_id ? String(row.document_id) : null,
      title: row.title,
      explorations: Number(row.explorations || 0),
    })),
    savedPaths: paths.rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      sourceDocumentId: String(row.source_document_id),
      targetDocumentId: String(row.target_document_id),
      path: row.path_json || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
};

module.exports = {
  findPath,
  getComparisonGraphOverlap,
  getGraph,
  getGraphProfileInsights,
  getKnowledgeGraphMetrics,
  getRelationshipContext,
  getRelationships,
  normalizeId,
  saveGraphPath,
  searchGraph,
};
