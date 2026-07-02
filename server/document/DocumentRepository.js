const { query } = require("../db");
const DocumentChat = require("../models/DocumentChat");
const {
  isGazetteScope,
  normalizeTypeList,
} = require("./documentTypes");

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const toIso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const mapDocument = (row) => {
  if (!row) return null;
  const source = row.canonical_source || row.source_name;
  const sourceUrl = row.canonical_url || row.detail_url || row.source_url;
  const metadata = {
    ...(row.source_metadata || {}),
    ...(row.metadata_json || {}),
  };
  const processingStatus =
    row.schema_processing_status || row.processing_status || null;
  const hasAccessibleResource =
    row.has_accessible_resource == null
      ? Boolean(row.pdf_url)
      : Boolean(row.has_accessible_resource);
  const readiness = !hasAccessibleResource
    ? (sourceUrl ? "source_only" : "missing_pdf")
    : processingStatus === "failed" ||
        row.extraction_status === "failed" ||
        row.embedding_status === "failed"
      ? "processing_failed"
      : row.research_ready
        ? "research_ready"
        : "pdf_available";
  return {
    id: String(row.id),
    documentId: String(row.id),
    canonicalId: row.canonical_id,
    title: row.title,
    type: row.document_type,
    documentType: row.document_type,
    subtype: row.category,
    authority: row.authority,
    jurisdiction: row.jurisdiction,
    jurisdictionLevel: row.jurisdiction_level,
    ministry: row.ministry,
    department: row.department,
    publicationDate: toIso(row.publication_date),
    introducedDate: toIso(row.introduced_date),
    passedDate: toIso(row.passed_date),
    enactedDate: toIso(row.enacted_date),
    assentDate: toIso(row.assent_date),
    effectiveDate: toIso(row.effective_date),
    commencementDate: toIso(row.commencement_date),
    year: row.year,
    status: row.status || null,
    source,
    sourceName: source,
    sourceUrl,
    pdfUrl: row.pdf_url,
    processingStatus,
    processingError: row.processing_error || null,
    extractionStatus: row.extraction_status || null,
    embeddingStatus: row.embedding_status || null,
    summaryStatus: row.summary_status || null,
    chunksCount: Number(row.chunks_count || 0),
    hasAccessibleResource,
    processedAt: toIso(row.processed_at),
    readiness,
    researchReady: readiness === "research_ready",
    qualityScore:
      row.quality_score == null ? null : Number(row.quality_score),
    visibilityStatus: row.visibility_status || "public",
    fileHash: row.file_hash || null,
    mimeType: row.mime_type || null,
    fileSizeBytes:
      row.file_size_bytes == null ? null : Number(row.file_size_bytes),
    number:
      row.bill_number ||
      row.act_number ||
      row.gazette_identifier ||
      row.legal_identifier ||
      null,
    billNumber: row.bill_number,
    actNumber: row.act_number,
    gazetteNumber: row.gazette_identifier || row.gazette_id,
    category: row.category,
    metadata,
    sourceType: metadata.sourceClassification || null,
    language: metadata.language || null,
    state: metadata.state || null,
    country: metadata.country || "India",
    summary: row.summary || null,
    recommendationScore:
      row.recommendation_score == null
        ? null
        : Number(row.recommendation_score),
    relationships: [],
    firstSeenAt: toIso(row.first_seen_at),
    updatedAt: toIso(row.updated_at),
    link: sourceUrl,
    pdf: row.pdf_url,
  };
};

const addParameter = (parameters, value) => {
  parameters.push(value);
  return `$${parameters.length}`;
};

const buildFilters = (options = {}) => {
  const parameters = [];
  const conditions = [];
  if (!options.includeInternal) {
    conditions.push(`COALESCE((
      SELECT schema_document.visibility_status
      FROM documents schema_document
      WHERE schema_document.id = legislative_documents.id
    ), 'public') NOT IN ('hidden_invalid', 'internal_only')`);
  }
  const rawType = String(options.type || "").trim().toLowerCase();
  const stateScopedType = [
    "state-bill",
    "state-bills",
    "state-act",
    "state-acts",
  ].includes(rawType);
  const types = normalizeTypeList(options.type || options.types);

  if (options.scope === "gazette") {
    conditions.push(`(
      COALESCE(canonical_source, source_name) IN ('egazette', 'state-gazette')
      OR gazette_identifier IS NOT NULL
      OR document_type IN (
        'gazette', 'notification', 'rule', 'regulation', 'order',
        'circular', 'ordinance'
      )
    )`);
  } else if (types.length) {
    conditions.push(
      `document_type = ANY(${addParameter(parameters, types)}::TEXT[])`,
    );
  }
  if (options.scope === "policy-national") {
    conditions.push(
      `(jurisdiction_level IS NULL OR jurisdiction_level <> 'state')`,
    );
  } else if (options.scope === "policy-state") {
    conditions.push(`jurisdiction_level = 'state'`);
  }

  const exactFilters = [
    ["status", "status"],
    ["ministry", "ministry"],
    ["department", "department"],
    ["authority", "authority"],
    ["category", "category"],
    ["jurisdiction", "jurisdiction"],
    ["jurisdictionLevel", "jurisdiction_level"],
  ];
  for (const [option, column] of exactFilters) {
    if (options[option] && options[option] !== "All") {
      conditions.push(
        `${column} = ${addParameter(parameters, options[option])}`,
      );
    }
  }
  if (stateScopedType && !options.jurisdictionLevel) {
    conditions.push(
      `jurisdiction_level = ${addParameter(parameters, "state")}`,
    );
  }
  if (options.source) {
    conditions.push(
      `COALESCE(canonical_source, source_name) = ${addParameter(
        parameters,
        options.source,
      )}`,
    );
  }
  const metadataFilters = [
    ["sourceType", "sourceClassification"],
    ["language", "language"],
    ["state", "state"],
  ];
  for (const [option, key] of metadataFilters) {
    if (options[option] && options[option] !== "All") {
      conditions.push(
        `metadata_json ->> '${key}' = ${addParameter(
          parameters,
          options[option],
        )}`,
      );
    }
  }
  if (options.year && options.year !== "All") {
    conditions.push(
      `year = ${addParameter(
        parameters,
        Number.parseInt(options.year, 10),
      )}`,
    );
  }
  if (options.publicationFrom) {
    conditions.push(
      `publication_date >= ${addParameter(
        parameters,
        options.publicationFrom,
      )}::DATE`,
    );
  }
  if (options.publicationTo) {
    conditions.push(
      `publication_date <= ${addParameter(
        parameters,
        options.publicationTo,
      )}::DATE`,
    );
  }
  if (options.hasPdf === true || options.hasPdf === "true") {
    conditions.push("pdf_url IS NOT NULL");
  }
  if (options.hasPdf === false || options.hasPdf === "false") {
    conditions.push("pdf_url IS NULL");
  }

  const search = String(options.search || options.q || "").trim();
  let searchCondition = null;
  if (search) {
    const searchParameter = addParameter(parameters, search);
    const likeParameter = addParameter(parameters, `%${search}%`);
    searchCondition = `(
      search_vector @@ websearch_to_tsquery('english', ${searchParameter})
      OR title ILIKE ${likeParameter}
      OR COALESCE(legal_identifier, '') ILIKE ${likeParameter}
      OR COALESCE(bill_number, '') ILIKE ${likeParameter}
      OR COALESCE(act_number, '') ILIKE ${likeParameter}
      OR COALESCE(gazette_identifier, '') ILIKE ${likeParameter}
      OR COALESCE(ministry, '') ILIKE ${likeParameter}
      OR COALESCE(authority, '') ILIKE ${likeParameter}
      OR COALESCE(category, '') ILIKE ${likeParameter}
      OR COALESCE(metadata_json::TEXT, '') ILIKE ${likeParameter}
      OR COALESCE(source_metadata::TEXT, '') ILIKE ${likeParameter}
    )`;
  }
  let semanticCondition = null;
  if (Array.isArray(options.semanticIds) && options.semanticIds.length) {
    semanticCondition =
      `id::TEXT = ANY(${addParameter(
        parameters,
        options.semanticIds.map(String),
      )}::TEXT[])`;
  }
  if (searchCondition && semanticCondition) {
    conditions.push(`(${searchCondition} OR ${semanticCondition})`);
  } else if (searchCondition) {
    conditions.push(searchCondition);
  } else if (semanticCondition) {
    conditions.push(semanticCondition);
  }

  return {
    parameters,
    where: conditions.length ? conditions.join(" AND ") : "TRUE",
  };
};

const DOCUMENT_DATE_EXPRESSION = `COALESCE(
  publication_date::TIMESTAMPTZ,
  introduced_date::TIMESTAMPTZ,
  passed_date::TIMESTAMPTZ,
  enacted_date::TIMESTAMPTZ,
  effective_date::TIMESTAMPTZ,
  commencement_date::TIMESTAMPTZ,
  CASE
    WHEN year BETWEEN 1800 AND 2200
      THEN MAKE_DATE(year, 1, 1)::TIMESTAMPTZ
  END,
  first_seen_at,
  updated_at,
  created_at
)`;

const SORT_COLUMNS = {
  relevance: "search_rank",
  publicationDate: DOCUMENT_DATE_EXPRESSION,
  updatedAt: "updated_at",
  title: "title",
  year: "year",
  ministry: "ministry",
};

const find = async (options = {}) => {
  const page = clampInteger(options.page, 1, 1, 100_000);
  const limit = clampInteger(options.limit, 20, 1, 100);
  const offset = (page - 1) * limit;
  const filters = buildFilters(options);
  const search = String(options.search || options.q || "").trim();
  const rankParameter = search
    ? addParameter(filters.parameters, search)
    : null;
  const rankExpression = rankParameter
    ? `ts_rank(search_vector, websearch_to_tsquery('english', ${rankParameter}))`
    : "0";
  const sortBy = SORT_COLUMNS[options.sortBy] || (
    search ? SORT_COLUMNS.relevance : SORT_COLUMNS.publicationDate
  );
  const sortDirection =
    String(options.sortDirection || "desc").toLowerCase() === "asc"
      ? "ASC"
      : "DESC";
  const limitParameter = addParameter(filters.parameters, limit);
  const offsetParameter = addParameter(filters.parameters, offset);

  const [documents, count] = await Promise.all([
    query(
      `SELECT *,
         COALESCE((
           SELECT schema_document.research_ready
           FROM documents schema_document
           WHERE schema_document.id = legislative_documents.id
         ), FALSE) AS research_ready,
         (
           SELECT schema_document.quality_score
           FROM documents schema_document
           WHERE schema_document.id = legislative_documents.id
         ) AS quality_score,
         (
           SELECT schema_document.visibility_status
           FROM documents schema_document
           WHERE schema_document.id = legislative_documents.id
         ) AS visibility_status,
         ${rankExpression} AS search_rank
       FROM legislative_documents
       WHERE ${filters.where}
       ORDER BY ${sortBy} ${sortDirection} NULLS LAST,
         updated_at DESC, id DESC
       LIMIT ${limitParameter}
       OFFSET ${offsetParameter}`,
      filters.parameters,
    ),
    query(
      `SELECT COUNT(*)::INTEGER AS total
       FROM legislative_documents
       WHERE ${filters.where}`,
      filters.parameters.slice(0, -(rankParameter ? 3 : 2)),
    ),
  ]);
  const total = count.rows[0]?.total || 0;
  return {
    documents: documents.rows.map(mapDocument),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + limit < total,
    },
  };
};

const search = (options = {}) => find(options);

const getById = async (id) => {
  const result = await query(
    `SELECT *,
       COALESCE((
         SELECT schema_document.research_ready
         FROM documents schema_document
         WHERE schema_document.id = legislative_documents.id
       ), FALSE) AS research_ready,
       (
         SELECT schema_document.quality_score
         FROM documents schema_document
         WHERE schema_document.id = legislative_documents.id
       ) AS quality_score,
       (
         SELECT schema_document.visibility_status
         FROM documents schema_document
         WHERE schema_document.id = legislative_documents.id
       ) AS visibility_status,
       EXISTS (
         SELECT 1 FROM document_resources resource
         WHERE resource.document_id = legislative_documents.id
           AND resource.resource_type IN ('pdf', 'text', 'html')
           AND resource.is_accessible
       ) AS has_accessible_resource,
       (
         SELECT state.processing_status
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS schema_processing_status,
       (
         SELECT state.extraction_status
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS extraction_status,
       (
         SELECT state.embedding_status
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS embedding_status,
       (
         SELECT state.summary_status
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS summary_status,
       (
         SELECT state.chunks_count
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS chunks_count
     FROM legislative_documents
     WHERE id::TEXT = $1 OR canonical_id = $1
     LIMIT 1`,
    [String(id)],
  );
  return mapDocument(result.rows[0]);
};

const findBySourceUrl = async (sourceUrl, type = null) => {
  const types = normalizeTypeList(type);
  const parameters = [sourceUrl];
  const typeCondition = types.length
    ? `AND document_type = ANY(${addParameter(parameters, types)}::TEXT[])`
    : "";
  const result = await query(
    `SELECT *
     FROM legislative_documents
     WHERE ($1 = source_url OR $1 = detail_url OR $1 = pdf_url)
       ${typeCondition}
     LIMIT 1`,
    parameters,
  );
  return mapDocument(result.rows[0]);
};

const updatePDF = async (id, pdfUrl) => {
  await query(
    `UPDATE legislative_documents
     SET pdf_url = $2, updated_at = NOW()
     WHERE id = $1`,
    [id, pdfUrl],
  );
};

const updateProcessingStatus = async (
  id,
  status,
  error = null,
  details = {},
) => {
  const errorMessage = error ? String(error).slice(0, 1_000) : null;
  const chunksCount = Math.max(0, Number(details.chunksCount || 0));
  await query(
    `UPDATE legislative_documents
     SET processing_status = $2,
         processing_error = $3,
         processed_at = CASE WHEN $2 = 'ready' THEN NOW() ELSE processed_at END,
         updated_at = NOW()
     WHERE id = $1`,
    [id, status, errorMessage],
  );
  await query(
    `INSERT INTO document_processing_state (
       document_id, processing_status, extraction_status, embedding_status,
       summary_status, ocr_status, error_message, chunks_count,
       embedding_provider, ai_provider, last_processed_at, updated_at
     )
     SELECT
       d.id,
       $2,
       CASE
         WHEN $2 = 'ready' THEN 'ready'
         WHEN $2 = 'failed' THEN 'failed'
         ELSE COALESCE(ps.extraction_status, 'not_started')
       END,
       CASE
         WHEN $2 = 'ready' THEN 'ready'
         WHEN $2 = 'failed' THEN 'failed'
         ELSE COALESCE(ps.embedding_status, 'not_started')
       END,
       CASE
         WHEN $2 = 'ready' THEN 'ready'
         WHEN $2 = 'failed' THEN 'failed'
         ELSE COALESCE(ps.summary_status, 'not_started')
       END,
       COALESCE(ps.ocr_status, 'not_required'),
       $3,
       GREATEST(COALESCE(ps.chunks_count, 0), $4),
       CASE WHEN $2 = 'ready' THEN $5 ELSE ps.embedding_provider END,
       CASE WHEN $2 = 'ready' THEN $6 ELSE ps.ai_provider END,
       CASE WHEN $2 = 'ready' THEN NOW() ELSE ps.last_processed_at END,
       NOW()
     FROM documents d
     LEFT JOIN document_processing_state ps ON ps.document_id = d.id
     WHERE d.id = $1
     ON CONFLICT (document_id) DO UPDATE SET
       processing_status = EXCLUDED.processing_status,
       extraction_status = EXCLUDED.extraction_status,
       embedding_status = EXCLUDED.embedding_status,
       summary_status = EXCLUDED.summary_status,
       ocr_status = EXCLUDED.ocr_status,
       error_message = EXCLUDED.error_message,
       chunks_count = GREATEST(
         document_processing_state.chunks_count,
         EXCLUDED.chunks_count
       ),
       embedding_provider = COALESCE(
         EXCLUDED.embedding_provider,
         document_processing_state.embedding_provider
       ),
       ai_provider = COALESCE(
         EXCLUDED.ai_provider,
         document_processing_state.ai_provider
       ),
       last_processed_at = COALESCE(
         EXCLUDED.last_processed_at,
         document_processing_state.last_processed_at
       ),
       updated_at = NOW()`,
    [
      id,
      status,
      errorMessage,
      chunksCount,
      details.embeddingProvider || process.env.OPENAI_EMBEDDING_MODEL || "openai",
      details.aiProvider || "openai",
    ],
  );
  await query(
    `UPDATE documents d
     SET research_ready = (
       d.canonical_url IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM document_resources r
         WHERE r.document_id = d.id
           AND r.resource_type IN ('pdf', 'text', 'html')
           AND r.is_accessible
       )
       AND EXISTS (
         SELECT 1 FROM document_processing_state ps
         WHERE ps.document_id = d.id
           AND ps.processing_status = 'ready'
           AND ps.extraction_status = 'ready'
           AND ps.embedding_status = 'ready'
           AND ps.chunks_count > 0
           AND ps.error_message IS NULL
       )
     ),
     updated_at = NOW()
     WHERE d.id = $1`,
    [id],
  );
};

const getResources = async (id) => {
  const result = await query(
    `SELECT label, resource_type, NULL::TEXT AS category, url,
       metadata_json AS metadata
     FROM document_resources
     WHERE document_id = $1
     ORDER BY is_primary DESC, resource_type, label, id`,
    [id],
  );
  return result.rows.map((row) => ({
    label: row.label,
    resourceType: row.resource_type,
    category: row.category,
    url: row.url,
    metadata: row.metadata || {},
  }));
};

const getRelated = async (id) => {
  const result = await query(
    `SELECT
       r.from_document_id, r.to_document_id,
       r.relationship_type, r.confidence,
       r.source_name AS relationship_source_name,
       r.source_url AS relationship_source_url,
       r.metadata_json AS relationship_metadata,
       related.*
     FROM document_relationships r
     JOIN legislative_documents related
       ON related.id = CASE
         WHEN r.from_document_id = $1 THEN r.to_document_id
         ELSE r.from_document_id
       END
     WHERE r.from_document_id = $1 OR r.to_document_id = $1
     ORDER BY r.confidence DESC NULLS LAST, related.updated_at DESC
     LIMIT 50`,
    [id],
  );
  return result.rows.map((row) => ({
    direction:
      String(row.from_document_id) === String(id) ? "outgoing" : "incoming",
    relationshipType: row.relationship_type,
    confidence: row.confidence == null ? null : Number(row.confidence),
    sourceName: row.relationship_source_name,
    sourceUrl: row.relationship_source_url,
    metadata: row.relationship_metadata || {},
    document: mapDocument(row),
  }));
};

const getSummary = async (id, userId = null) => {
  if (!userId) return null;
  const result = await query(
    `SELECT summary
     FROM document_chats
     WHERE user_id = $1 AND document_id = $2
       AND summary IS NOT NULL AND summary <> ''
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, String(id)],
  );
  return result.rows[0]?.summary || null;
};

const getPDF = async (id) => {
  const document = await getById(id);
  return document?.pdfUrl || null;
};

const getChatHistory = (userId, documentType, id) =>
  DocumentChat.findOne(userId, documentType, id);

const getRecommendations = async (id, userId = null, limit = 8) => {
  const {
    getDocumentRecommendations,
  } = require("./recommendationService");
  return getDocumentRecommendations(id, userId, { limit });
};

const getRelatedChats = async (id, userId = null, limit = 6) => {
  if (!userId) return [];
  const safeLimit = clampInteger(limit, 6, 1, 20);
  const result = await query(
    `WITH current_document AS (
       SELECT *
       FROM legislative_documents
       WHERE id = $1
     ),
     ranked_chats AS (
       SELECT
         chat.id,
         chat.document_type,
         chat.document_id,
         chat.document_title,
         chat.summary,
         chat.is_pinned,
         chat.last_message_at,
         chat.last_accessed_at,
         chat.updated_at,
         (
           CASE WHEN candidate.ministry IS NOT NULL
             AND candidate.ministry = current.ministry THEN 4 ELSE 0 END
           + CASE WHEN candidate.authority IS NOT NULL
             AND candidate.authority = current.authority THEN 3 ELSE 0 END
           + CASE WHEN candidate.category IS NOT NULL
             AND candidate.category = current.category THEN 2 ELSE 0 END
           + CASE WHEN candidate.jurisdiction IS NOT NULL
             AND candidate.jurisdiction = current.jurisdiction THEN 1 ELSE 0 END
           + CASE WHEN EXISTS (
               SELECT 1
               FROM document_relationships relationship
               WHERE (
                 relationship.from_document_id = current.id
                 AND relationship.to_document_id = candidate.id
               ) OR (
                 relationship.to_document_id = current.id
                 AND relationship.from_document_id = candidate.id
               )
             ) THEN 8 ELSE 0 END
         ) AS related_score
       FROM document_chats chat
       JOIN legislative_documents candidate
         ON candidate.id::TEXT = chat.document_id
         OR candidate.canonical_id = chat.document_id
       CROSS JOIN current_document current
       WHERE chat.user_id = $2
         AND chat.is_active = TRUE
         AND candidate.id <> current.id
     )
     SELECT
       *
     FROM ranked_chats
     WHERE related_score > 0
     ORDER BY related_score DESC,
       is_pinned DESC,
       GREATEST(
         last_accessed_at,
         last_message_at,
         updated_at
       ) DESC
     LIMIT $3`,
    [id, userId, safeLimit],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    documentType: row.document_type,
    documentId: row.document_id,
    title: row.document_title,
    summary: row.summary,
    isPinned: row.is_pinned,
    lastMessageAt: toIso(row.last_message_at),
    lastAccessedAt: toIso(row.last_accessed_at),
    relatedScore: Number(row.related_score || 0),
  }));
};

const getTimeline = async (
  id,
  documentValue = null,
  relationshipValues = null,
) => {
  const document = documentValue || await getById(id);
  if (!document) return [];
  const events = [
    ["introduced", "Bill introduced", document.introducedDate],
    ["passed", "Passed by legislature", document.passedDate],
    ["assent", "Received assent", document.assentDate],
    ["enacted", "Enacted", document.enactedDate],
    ["published", "Published", document.publicationDate],
    ["effective", "Became effective", document.effectiveDate],
    ["commenced", "Commenced", document.commencementDate],
  ]
    .filter(([, , date]) => date)
    .map(([type, label, date]) => ({ type, label, date, documentId: String(id) }));
  const intelligence = await query(
    `SELECT event_type, title, summary, event_date, source_name, source_url
     FROM intelligence_events
     WHERE document_id = $1
     ORDER BY event_date ASC NULLS LAST, created_at ASC`,
    [id],
  );
  events.push(
    ...intelligence.rows.map((row) => ({
      type: row.event_type,
      label: row.title,
      description: row.summary,
      date: toIso(row.event_date),
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      documentId: String(id),
    })),
  );
  const relationships = relationshipValues || await getRelated(id);
  events.push(
    ...relationships
      .filter(
        (relationship) =>
          relationship.document.publicationDate ||
          relationship.document.enactedDate ||
          relationship.document.introducedDate,
      )
      .map((relationship) => ({
        type: relationship.relationshipType,
        label: `${relationship.relationshipType.replace(/_/g, " ")}: ${
          relationship.document.title
        }`,
        date:
          relationship.document.publicationDate ||
          relationship.document.enactedDate ||
          relationship.document.introducedDate,
        documentId: relationship.document.id,
        sourceUrl: relationship.sourceUrl,
      })),
  );
  return events.sort((left, right) =>
    String(left.date || "").localeCompare(String(right.date || "")),
  );
};

const getGraph = async (
  id,
  documentValue = null,
  relationshipValues = null,
) => {
  const document = documentValue || await getById(id);
  if (!document) return { nodes: [], edges: [] };
  const relationships = relationshipValues || await getRelated(id);
  const nodes = [
    {
      id: `document:${document.id}`,
      kind: document.type,
      label: document.title,
      document,
    },
  ];
  const edges = [];
  for (const relationship of relationships) {
    const related = relationship.document;
    nodes.push({
      id: `document:${related.id}`,
      kind: related.type,
      label: related.title,
      document: related,
    });
    const outgoing = relationship.direction !== "incoming";
    edges.push({
      from: outgoing
        ? `document:${document.id}`
        : `document:${related.id}`,
      to: outgoing
        ? `document:${related.id}`
        : `document:${document.id}`,
      type: relationship.relationshipType,
      confidence: relationship.confidence,
    });
  }
  const committee =
    document.metadata?.committee ||
    document.metadata?.committeeName ||
    document.metadata?.committee_name ||
    (document.type === "committee_report" ? document.authority : null);
  for (const [kind, label] of [
    ["authority", document.authority],
    ["ministry", document.ministry],
    [
      document.jurisdictionLevel === "state" ? "state" : "jurisdiction",
      document.jurisdiction,
    ],
    ["committee", committee],
  ]) {
    if (!label) continue;
    const nodeId = `${kind}:${label}`;
    nodes.push({ id: nodeId, kind, label });
    edges.push({
      from: `document:${document.id}`,
      to: nodeId,
      type: kind === "authority" ? "issued_by" : "belongs_to",
    });
  }
  return { rootId: `document:${document.id}`, nodes, edges };
};

const getFilterOptions = async (options = {}) => {
  const filters = buildFilters({
    type: options.type,
    scope: options.scope,
    jurisdictionLevel: options.jurisdictionLevel,
  });
  const result = await query(
    `SELECT
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT document_type ORDER BY document_type), NULL) AS types,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT status ORDER BY status), NULL) AS statuses,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT year ORDER BY year DESC), NULL) AS years,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT ministry ORDER BY ministry), NULL) AS ministries,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT department ORDER BY department), NULL) AS departments,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT authority ORDER BY authority), NULL) AS authorities,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT category ORDER BY category), NULL) AS categories,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT jurisdiction ORDER BY jurisdiction), NULL) AS jurisdictions,
       ARRAY_REMOVE(
         ARRAY_AGG(
           DISTINCT COALESCE(canonical_source, source_name)
           ORDER BY COALESCE(canonical_source, source_name)
         ),
         NULL
       ) AS sources,
       ARRAY_REMOVE(
         ARRAY_AGG(
           DISTINCT metadata_json ->> 'sourceClassification'
           ORDER BY metadata_json ->> 'sourceClassification'
         ),
         NULL
       ) AS source_types,
       ARRAY_REMOVE(
         ARRAY_AGG(
           DISTINCT metadata_json ->> 'language'
           ORDER BY metadata_json ->> 'language'
         ),
         NULL
       ) AS languages,
       ARRAY_REMOVE(
         ARRAY_AGG(
           DISTINCT metadata_json ->> 'state'
           ORDER BY metadata_json ->> 'state'
         ),
         NULL
       ) AS states
     FROM legislative_documents
     WHERE ${filters.where}`,
    filters.parameters,
  );
  return result.rows[0] || {};
};

module.exports = {
  DOCUMENT_DATE_EXPRESSION,
  buildFilters,
  find,
  findBySourceUrl,
  getById,
  getChatHistory,
  getFilterOptions,
  getGraph,
  getPDF,
  getRecommendations,
  getRelatedChats,
  getRelated,
  getResources,
  getSummary,
  getTimeline,
  isGazetteScope,
  mapDocument,
  search,
  updatePDF,
  updateProcessingStatus,
};
