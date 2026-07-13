const { query } = require("../db");
const DocumentChat = require("../models/DocumentChat");
const {
  isGazetteScope,
  normalizeTypeList,
} = require("./documentTypes");
const { sanitizeProviderError } = require("../lib/providerErrorSanitizer");
const { classifyFailure } = require("./failureTaxonomy");
const {
  normalizeNullableString,
  safeDate,
  safeInteger,
  safeNumber,
  safeObject,
} = require("../lib/safeData");

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const toIso = safeDate;
const sanitizeNullableError = (value) =>
  value == null || String(value).trim() === ""
    ? null
    : sanitizeProviderError(value);

const mapDocumentResourceSafely = (row = {}) => ({
  id: row.id == null ? null : String(row.id),
  label: normalizeNullableString(row.label) || "Document resource",
  resourceType: normalizeNullableString(row.resource_type) || "link",
  category: normalizeNullableString(row.category),
  url: normalizeNullableString(row.url),
  mimeType: normalizeNullableString(row.mime_type),
  fileExtension: normalizeNullableString(row.file_extension),
  fileSize:
    row.file_size == null && row.file_size_bytes == null
      ? null
      : safeNumber(row.file_size ?? row.file_size_bytes, null),
  language: normalizeNullableString(row.language),
  isPrimary: Boolean(row.is_primary),
  isAccessible: Boolean(row.is_accessible),
  lastCheckedAt: toIso(row.last_checked_at),
  metadata: safeObject(row.metadata_json ?? row.metadata),
});

const mapDocumentSourceSafely = (row = {}) => ({
  id: row.id == null ? null : String(row.id),
  sourceName: normalizeNullableString(row.source_name),
  normalizedSourceName: normalizeNullableString(row.normalized_source_name),
  sourceType: normalizeNullableString(row.source_type),
  sourceRecordId: normalizeNullableString(row.source_record_id),
  title:
    normalizeNullableString(row.raw_title) ||
    normalizeNullableString(row.source_title),
  status:
    normalizeNullableString(row.raw_status) ||
    normalizeNullableString(row.source_status),
  sourceUrl: normalizeNullableString(row.source_url),
  detailUrl: normalizeNullableString(row.detail_url),
  canonicalUrl: normalizeNullableString(row.canonical_url),
  sourcePriority: safeInteger(row.source_priority, 100),
  collectedAt: toIso(row.collected_at),
  lastSeenAt: toIso(row.last_seen_at),
  metadata: safeObject(row.raw_metadata_json ?? row.metadata_json ?? row.metadata),
});

const mapRelationshipSafely = (relationship = {}) => {
  const relatedDocument = safeObject(relationship.document, {});
  return {
    ...relationship,
    id: relationship.id == null ? null : String(relationship.id),
    document: {
      ...relatedDocument,
      id:
        relatedDocument.id == null
          ? null
          : String(relatedDocument.id),
      title:
        normalizeNullableString(relatedDocument.title) ||
        "Related document",
      publicationDate: toIso(relatedDocument.publicationDate),
      enactedDate: toIso(relatedDocument.enactedDate),
      introducedDate: toIso(relatedDocument.introducedDate),
    },
    relationshipType:
      normalizeNullableString(
        relationship.relationshipType || relationship.type,
      ) || "related",
    sourceUrl: normalizeNullableString(relationship.sourceUrl),
  };
};

const mapDocument = (row) => {
  if (!row) return null;
  const source =
    normalizeNullableString(row.canonical_source) ||
    normalizeNullableString(row.source_name);
  const sourceUrl =
    normalizeNullableString(row.canonical_url) ||
    normalizeNullableString(row.detail_url) ||
    normalizeNullableString(row.source_url);
  const metadata = {
    ...safeObject(row.source_metadata),
    ...safeObject(row.metadata_json),
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
    canonicalId: normalizeNullableString(row.canonical_id),
    title: normalizeNullableString(row.title) || "Untitled document",
    type: normalizeNullableString(row.document_type) || "document",
    documentType: normalizeNullableString(row.document_type) || "document",
    subtype: normalizeNullableString(row.category),
    authority: normalizeNullableString(row.authority),
    jurisdiction: normalizeNullableString(row.jurisdiction),
    jurisdictionLevel: normalizeNullableString(row.jurisdiction_level),
    ministry: normalizeNullableString(row.ministry),
    department: normalizeNullableString(row.department),
    publicationDate: toIso(row.publication_date),
    introducedDate: toIso(row.introduced_date),
    passedDate: toIso(row.passed_date),
    enactedDate: toIso(row.enacted_date),
    assentDate: toIso(row.assent_date),
    effectiveDate: toIso(row.effective_date),
    commencementDate: toIso(row.commencement_date),
    year: row.year,
    status: normalizeNullableString(row.status),
    source,
    sourceName: source,
    sourceUrl,
    pdfUrl: normalizeNullableString(row.pdf_url),
    processingStatus,
    processingError: sanitizeNullableError(row.processing_error),
    extractionStatus: row.extraction_status || null,
    embeddingStatus: row.embedding_status || null,
    summaryStatus: row.summary_status || null,
    pdfStatus: row.pdf_status || null,
    ocrStatus: row.ocr_status || null,
    chunkingStatus: row.chunking_status || null,
    chunksCount: safeInteger(row.chunks_count, 0),
    embeddingsCount: safeInteger(row.embeddings_count, 0),
    retrievalMode: row.retrieval_mode || "unknown",
    retrievalVerified: Boolean(row.retrieval_verified),
    retrievalVerifiedAt: toIso(row.retrieval_verified_at),
    textLength: safeInteger(row.text_length, 0),
    retryCount: safeInteger(row.retry_count, 0),
    failureStage: row.failure_stage || null,
    failureReason: sanitizeNullableError(
      row.failure_reason || row.processing_error || null,
    ),
    failureDetails: safeObject(row.failure_details_json),
    readinessClass: row.readiness_class || readiness,
    readinessReason: row.readiness_reason || null,
    lastAttemptedAt: toIso(row.last_attempted_at),
    hasAccessibleResource,
    processedAt: toIso(row.processed_at),
    readiness,
    researchReady: readiness === "research_ready",
    comparisonReady: Boolean(
      row.comparison_ready &&
      readiness === "research_ready",
    ),
    qualityScore: safeNumber(row.quality_score, null),
    visibilityStatus: row.visibility_status || "public",
    fileHash: row.file_hash || null,
    mimeType: row.mime_type || null,
    fileSizeBytes: safeNumber(row.file_size_bytes, null),
    number:
      row.bill_number ||
      row.act_number ||
      row.gazette_identifier ||
      row.legal_identifier ||
      null,
    billNumber: row.bill_number,
    actNumber: row.act_number,
    gazetteNumber: row.gazette_identifier || row.gazette_id,
    category: normalizeNullableString(row.category),
    metadata,
    sourceType: metadata.sourceClassification || null,
    language: metadata.language || null,
    state: metadata.state || null,
    country: metadata.country || "India",
    summary: normalizeNullableString(row.summary),
    recommendationScore:
      row.recommendation_score == null
        ? null
        : safeNumber(row.recommendation_score, null),
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
  if (options.researchReady === true || options.researchReady === "true") {
    conditions.push(`EXISTS (
      SELECT 1 FROM documents readiness_document
      WHERE readiness_document.id = legislative_documents.id
        AND readiness_document.research_ready
    )`);
  }
  if (options.researchReady === false || options.researchReady === "false") {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM documents readiness_document
      WHERE readiness_document.id = legislative_documents.id
        AND readiness_document.research_ready
    )`);
  }
  if (
    options.comparisonReady === true ||
    options.comparisonReady === "true"
  ) {
    conditions.push(`EXISTS (
      SELECT 1 FROM documents readiness_document
      WHERE readiness_document.id = legislative_documents.id
        AND readiness_document.comparison_ready
    )`);
  }
  if (
    options.comparisonReady === false ||
    options.comparisonReady === "false"
  ) {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM documents readiness_document
      WHERE readiness_document.id = legislative_documents.id
        AND readiness_document.comparison_ready
    )`);
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
         COALESCE((
           SELECT schema_document.comparison_ready
           FROM documents schema_document
           WHERE schema_document.id = legislative_documents.id
         ), FALSE) AS comparison_ready,
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
         (
           SELECT state.readiness_class
           FROM document_processing_state state
           WHERE state.document_id = legislative_documents.id
         ) AS readiness_class,
         (
           SELECT state.readiness_reason
           FROM document_processing_state state
           WHERE state.document_id = legislative_documents.id
         ) AS readiness_reason,
         (
           SELECT state.failure_reason
           FROM document_processing_state state
           WHERE state.document_id = legislative_documents.id
         ) AS failure_reason,
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
       COALESCE((
         SELECT schema_document.comparison_ready
         FROM documents schema_document
         WHERE schema_document.id = legislative_documents.id
       ), FALSE) AS comparison_ready,
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
         SELECT state.pdf_status
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS pdf_status,
       (
         SELECT state.ocr_status
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS ocr_status,
       (
         SELECT state.chunking_status
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS chunking_status,
       (
         SELECT state.chunks_count
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS chunks_count,
       (
         SELECT state.embeddings_count
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS embeddings_count,
       (
         SELECT state.retrieval_mode
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS retrieval_mode,
       (
         SELECT state.retrieval_verified
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS retrieval_verified,
       (
         SELECT state.retrieval_verified_at
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS retrieval_verified_at,
       (
         SELECT state.text_length
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS text_length,
       (
         SELECT state.retry_count
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS retry_count,
       (
         SELECT state.failure_stage
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS failure_stage,
       (
         SELECT state.failure_reason
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS failure_reason,
       (
         SELECT state.failure_details_json
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS failure_details_json,
       (
         SELECT state.readiness_class
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS readiness_class,
       (
         SELECT state.readiness_reason
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS readiness_reason,
       (
         SELECT state.last_attempted_at
         FROM document_processing_state state
         WHERE state.document_id = legislative_documents.id
       ) AS last_attempted_at
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
  const errorMessage = error ? sanitizeProviderError(error) : null;
  const existingResult = await query(
    `SELECT * FROM document_processing_state WHERE document_id = $1`,
    [id],
  );
  const existing = existingResult.rows[0] || {};
  const chunksCount = Math.max(
    0,
    Number(details.chunksCount ?? existing.chunks_count ?? 0),
  );
  const embeddingsCount = Math.max(
    0,
    Number(details.embeddingsCount ?? existing.embeddings_count ?? 0),
  );
  const failureStage =
    details.failureStage || (status === "failed" ? "processing" : null);
  const stageStatus = (name, readyValue = "ready") =>
    details[name] ||
    (status === "ready"
      ? readyValue
      : status === "failed" &&
          failureStage === name.replace("Status", "").toLowerCase()
        ? "failed"
        : existing[
          name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
        ] || "not_started");
  const extractionStatus = stageStatus("extractionStatus");
  const embeddingStatus = stageStatus("embeddingStatus");
  const summaryStatus = stageStatus("summaryStatus");
  const chunkingStatus = stageStatus("chunkingStatus");
  const ocrStatus =
    details.ocrStatus ||
    existing.ocr_status ||
    (details.ocrRequired ? "pending" : "not_required");
  const pdfStatus =
    details.pdfStatus ||
    existing.pdf_status ||
    (status === "ready" ? "available" : "unknown");
  const failureReason =
    details.failureReason || errorMessage || null;
  const structuredFailure = status === "failed"
    ? classifyFailure({
        failureStage,
        failureReason,
        errorMessage,
        readinessReason: details.readinessReason,
        processingStatus: status,
        pdfStatus,
        extractionStatus,
        embeddingStatus,
        summaryStatus,
        ocrStatus,
        chunksCount,
      })
    : {
        failureCode: details.failureCode ?? null,
        retryEligible: details.retryEligible ?? true,
        pipelineStage: details.pipelineStage ?? null,
      };
  const failureCode = details.failureCode ?? structuredFailure.failureCode;
  const retryEligible = Boolean(
    details.retryEligible ?? structuredFailure.retryEligible,
  );
  const pipelineStage =
    details.pipelineStage || structuredFailure.pipelineStage || failureStage;
  const readinessClass =
    details.readinessClass ||
    (status === "ready"
      ? "comparison_ready"
      : status === "failed"
        ? "processing_failed_retriable"
        : "processing_pending");
  const readinessReason =
    details.readinessReason ||
    (status === "ready" ? null : failureReason || "Document processing is pending.");
  const retrievalMode =
    details.retrievalMode ||
    existing.retrieval_mode ||
    (status === "ready" ? "vector" : "unknown");
  const retrievalVerified = Boolean(
    details.retrievalVerified ?? existing.retrieval_verified,
  );
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
       embedding_provider, ai_provider, last_processed_at, updated_at,
       pdf_status, chunking_status, research_ready, comparison_ready,
       embeddings_count, text_length, language, script, is_bilingual,
       retry_count, failure_stage, failure_reason, failure_details_json,
       readiness_class, readiness_reason, last_attempted_at,
       retrieval_mode, retrieval_verified, retrieval_verified_at,
       failure_code, retry_eligible, pipeline_stage, extraction_method,
       worker_version, estimated_cost_usd
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       CASE WHEN $2 = 'ready' THEN NOW() ELSE $11 END,
       NOW(), $12, $13, FALSE, FALSE, $14, $15, $16, $17, $18,
       $19, $20, $21, $22::jsonb, $23, $24, NOW(),
       $25, $26, CASE WHEN $26 THEN NOW() ELSE NULL END,
       $27, $28, $29, $30, $31, $32
     )
     ON CONFLICT (document_id) DO UPDATE SET
       processing_status = EXCLUDED.processing_status,
       extraction_status = EXCLUDED.extraction_status,
       embedding_status = EXCLUDED.embedding_status,
       summary_status = EXCLUDED.summary_status,
       ocr_status = EXCLUDED.ocr_status,
       error_message = EXCLUDED.error_message,
       chunks_count = EXCLUDED.chunks_count,
       embedding_provider = EXCLUDED.embedding_provider,
       ai_provider = EXCLUDED.ai_provider,
       last_processed_at = COALESCE(
         EXCLUDED.last_processed_at,
         document_processing_state.last_processed_at
       ),
       pdf_status = EXCLUDED.pdf_status,
       chunking_status = EXCLUDED.chunking_status,
       embeddings_count = EXCLUDED.embeddings_count,
       text_length = EXCLUDED.text_length,
       language = EXCLUDED.language,
       script = EXCLUDED.script,
       is_bilingual = EXCLUDED.is_bilingual,
       retry_count = EXCLUDED.retry_count,
       failure_stage = EXCLUDED.failure_stage,
       failure_reason = EXCLUDED.failure_reason,
       failure_details_json = EXCLUDED.failure_details_json,
       readiness_class = EXCLUDED.readiness_class,
       readiness_reason = EXCLUDED.readiness_reason,
       last_attempted_at = EXCLUDED.last_attempted_at,
       retrieval_mode = EXCLUDED.retrieval_mode,
       retrieval_verified = EXCLUDED.retrieval_verified,
       retrieval_verified_at = COALESCE(
         EXCLUDED.retrieval_verified_at,
         document_processing_state.retrieval_verified_at
       ),
       failure_code = EXCLUDED.failure_code,
       retry_eligible = EXCLUDED.retry_eligible,
       pipeline_stage = EXCLUDED.pipeline_stage,
       extraction_method = EXCLUDED.extraction_method,
       worker_version = EXCLUDED.worker_version,
       estimated_cost_usd = EXCLUDED.estimated_cost_usd,
       updated_at = NOW()`,
    [
      id,
      status,
      extractionStatus,
      embeddingStatus,
      summaryStatus,
      ocrStatus,
      errorMessage,
      chunksCount,
      details.embeddingProvider ||
        process.env.EMBEDDING_PROVIDER ||
        process.env.GEMINI_EMBEDDING_MODEL ||
        process.env.OPENAI_EMBEDDING_MODEL ||
        "gemini",
      details.aiProvider || process.env.AI_PROVIDER || "gemini",
      existing.last_processed_at || null,
      pdfStatus,
      chunkingStatus,
      embeddingsCount,
      Math.max(0, Number(details.textLength ?? existing.text_length ?? 0)),
      details.language || existing.language || null,
      details.script || existing.script || null,
      Boolean(details.isBilingual ?? existing.is_bilingual),
      Number(existing.retry_count || 0) +
        (status === "failed" ? 1 : 0),
      failureStage,
      failureReason,
      JSON.stringify(details.failureDetails || {}),
      readinessClass,
      readinessReason,
      retrievalMode,
      retrievalVerified,
      failureCode,
      retryEligible,
      pipelineStage,
      details.extractionMethod || existing.extraction_method || null,
      details.workerVersion || existing.worker_version || null,
      details.estimatedCostUsd ?? existing.estimated_cost_usd ?? null,
    ],
  );
  await query(
    `UPDATE documents d
     SET research_ready = (
       EXISTS (
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
           AND ps.chunking_status = 'ready'
           AND ps.chunks_count > 0
           AND (
             (
               ps.embedding_status = 'ready'
               AND ps.embeddings_count >= ps.chunks_count
             )
             OR (
               ps.embedding_status = 'fallback'
               AND ps.retrieval_mode IN ('local_text', 'hybrid')
             )
           )
           AND ps.retrieval_verified
           AND ps.error_message IS NULL
           AND $2 = 'ready'
           AND $3
       )
     ),
     comparison_ready = (
       EXISTS (
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
           AND ps.chunking_status = 'ready'
           AND ps.chunks_count > 0
           AND (
             (
               ps.embedding_status = 'ready'
               AND ps.embeddings_count >= ps.chunks_count
             )
             OR (
               ps.embedding_status = 'fallback'
               AND ps.retrieval_mode IN ('local_text', 'hybrid')
             )
           )
           AND ps.retrieval_verified
           AND ps.error_message IS NULL
           AND $2 = 'ready'
           AND $3
       )
     ),
     updated_at = NOW()
     WHERE d.id = $1`,
    [id, status, details.retrievalVerified === true],
  );
  await query(
    `UPDATE document_processing_state state
     SET research_ready = document.research_ready,
         comparison_ready = document.comparison_ready,
         readiness_class = CASE
           WHEN document.comparison_ready THEN 'comparison_ready'
           WHEN document.research_ready THEN 'research_ready'
           ELSE state.readiness_class
         END,
         readiness_reason = CASE
           WHEN document.research_ready THEN NULL
           ELSE state.readiness_reason
         END,
         updated_at = NOW()
     FROM documents document
     WHERE document.id = state.document_id
       AND state.document_id = $1`,
    [id],
  );
};

const getResources = async (id) => {
  const result = await query(
    `SELECT id, label, resource_type, NULL::TEXT AS category, url,
       mime_type, file_extension, file_size, language, is_primary,
       is_accessible, last_checked_at, metadata_json
     FROM document_resources
     WHERE document_id = $1
     ORDER BY is_primary DESC, resource_type, label, id`,
    [id],
  );
  return result.rows.map(mapDocumentResourceSafely);
};

const getSources = async (id) => {
  const result = await query(
    `SELECT id, source_name, normalized_source_name, source_type,
       source_record_id, source_url, detail_url, canonical_url,
       raw_title, raw_status, source_title, source_status,
       source_priority, raw_metadata_json,
       collected_at, last_seen_at
     FROM document_sources
     WHERE document_id = $1
     ORDER BY source_priority ASC NULLS LAST, id ASC`,
    [id],
  );
  return result.rows.map(mapDocumentSourceSafely);
};

const getRelated = async (id) => {
  const { getRelationships } = require("../graph/knowledgeGraphService");
  const result = await getRelationships(id, { limit: 50 });
  return (result.relationships || []).map(mapRelationshipSafely);
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

const getRecommendations = async (
  id,
  userId = null,
  limit = 8,
  options = {},
) => {
  const {
    getDocumentRecommendations,
  } = require("./recommendationService");
  return getDocumentRecommendations(id, userId, { limit, ...options });
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
          relationship?.document?.publicationDate ||
          relationship?.document?.enactedDate ||
          relationship?.document?.introducedDate,
      )
      .map((relationship) => ({
        type: relationship.relationshipType || "related",
        label: `${String(
          relationship.relationshipType || "related",
        ).replace(/_/g, " ")}: ${
          relationship.document?.title || "Related document"
        }`,
        date:
          relationship.document?.publicationDate ||
          relationship.document?.enactedDate ||
          relationship.document?.introducedDate,
        documentId: relationship.document?.id || null,
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
  const { getGraph: loadGraph } = require("../graph/knowledgeGraphService");
  return loadGraph(id, { depth: 1, limit: 80 });
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
  getSources,
  getSummary,
  getTimeline,
  isGazetteScope,
  mapDocumentResourceSafely,
  mapDocumentSourceSafely,
  mapRelationshipSafely,
  mapDocument,
  search,
  updatePDF,
  updateProcessingStatus,
};
