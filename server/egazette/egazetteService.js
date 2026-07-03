const { query } = require("../db");

const GAZETTE_TYPES = [
  "gazette",
  "notification",
  "rule",
  "regulation",
  "ordinance",
  "order",
];

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const gazetteScope = (alias = "d") => `(
  ${alias}.source_name IN ('egazette', 'state-gazette')
  OR ${alias}.canonical_source IN ('egazette', 'state-gazette')
  OR ${alias}.gazette_identifier IS NOT NULL
  OR ${alias}.document_type = 'gazette'
)`;

const mergeMetadata = (row) => ({
  ...(row.source_metadata || {}),
  ...(row.metadata_json || {}),
});

const mapGazette = (row) => {
  if (!row) return null;
  const metadata = mergeMetadata(row);
  return {
    id: String(row.id),
    canonicalId: row.canonical_id,
    title: row.title,
    gazetteNumber:
      row.gazette_identifier ||
      row.gazette_id ||
      row.legal_identifier ||
      metadata.gazetteNumber ||
      null,
    notificationNumber:
      metadata.notificationNumber ||
      metadata.notification_number ||
      row.legal_identifier ||
      null,
    notificationType: row.document_type,
    gazetteType:
      metadata.gazetteType ||
      metadata.gazette_type ||
      row.category ||
      null,
    ministry: row.ministry,
    department: row.department,
    authority: row.authority,
    publicationDate: row.publication_date,
    effectiveDate: row.effective_date,
    year: row.year,
    jurisdiction: row.jurisdiction,
    jurisdictionLevel: row.jurisdiction_level,
    sourceName: row.canonical_source || row.source_name,
    sourceUrl: row.canonical_url || row.detail_url || row.source_url,
    pdfUrl: row.pdf_url,
    status: row.status || "Published",
    hasPdf: Boolean(row.pdf_url),
    category: row.category,
    metadata,
    firstSeenAt: row.first_seen_at,
    updatedAt: row.updated_at,
  };
};

const buildFilters = (options = {}) => {
  const parameters = [];
  const conditions = [gazetteScope("d")];
  const add = (value) => {
    parameters.push(value);
    return `$${parameters.length}`;
  };

  if (options.search) {
    const parameter = add(`%${String(options.search).trim()}%`);
    const indexedIds =
      Array.isArray(options.indexedIds) && options.indexedIds.length
        ? add(options.indexedIds.map(String))
        : null;
    conditions.push(`(
      d.title ILIKE ${parameter}
      OR COALESCE(d.gazette_identifier, '') ILIKE ${parameter}
      OR COALESCE(d.legal_identifier, '') ILIKE ${parameter}
      OR COALESCE(d.ministry, '') ILIKE ${parameter}
      OR COALESCE(d.department, '') ILIKE ${parameter}
      OR COALESCE(d.authority, '') ILIKE ${parameter}
      OR COALESCE(d.source_metadata::TEXT, '') ILIKE ${parameter}
      OR COALESCE(d.metadata_json::TEXT, '') ILIKE ${parameter}
      ${indexedIds ? `OR d.id::TEXT = ANY(${indexedIds}::TEXT[])` : ""}
    )`);
  }
  if (options.ministry) {
    conditions.push(`d.ministry = ${add(options.ministry)}`);
  }
  if (options.department) {
    conditions.push(`d.department = ${add(options.department)}`);
  }
  if (options.notificationType) {
    conditions.push(
      `d.document_type = ${add(options.notificationType)}`,
    );
  }
  if (options.gazetteType) {
    const parameter = add(options.gazetteType);
    conditions.push(`(
      d.category = ${parameter}
      OR d.metadata_json->>'gazetteType' = ${parameter}
      OR d.metadata_json->>'gazette_type' = ${parameter}
    )`);
  }
  if (options.jurisdiction) {
    conditions.push(`d.jurisdiction = ${add(options.jurisdiction)}`);
  }
  if (options.year) {
    conditions.push(`d.year = ${add(Number.parseInt(options.year, 10))}`);
  }
  if (options.publicationFrom) {
    conditions.push(
      `d.publication_date >= ${add(options.publicationFrom)}::DATE`,
    );
  }
  if (options.publicationTo) {
    conditions.push(
      `d.publication_date <= ${add(options.publicationTo)}::DATE`,
    );
  }
  if (options.source) {
    const parameter = add(options.source);
    conditions.push(
      `COALESCE(d.canonical_source, d.source_name) = ${parameter}`,
    );
  }
  if (options.hasPdf === "true" || options.hasPdf === true) {
    conditions.push("d.pdf_url IS NOT NULL");
  } else if (options.hasPdf === "false" || options.hasPdf === false) {
    conditions.push("d.pdf_url IS NULL");
  }

  return { parameters, where: conditions.join(" AND ") };
};

const SORT_COLUMNS = {
  publicationDate: "d.publication_date",
  title: "d.title",
  ministry: "d.ministry",
  gazetteNumber: "d.gazette_identifier",
  updatedAt: "d.updated_at",
};

const listGazettes = async (options = {}) => {
  const page = clampInteger(options.page, 1, 1, 100_000);
  const limit = clampInteger(options.limit, 20, 1, 100);
  const offset = (page - 1) * limit;
  const filters = buildFilters(options);
  const sortColumn = SORT_COLUMNS[options.sortBy] || SORT_COLUMNS.publicationDate;
  const sortDirection =
    String(options.sortDirection || "desc").toLowerCase() === "asc"
      ? "ASC"
      : "DESC";
  const limitParameter = filters.parameters.length + 1;
  const offsetParameter = filters.parameters.length + 2;

  const [documents, count] = await Promise.all([
    query(
      `SELECT d.*
       FROM legislative_documents d
       WHERE ${filters.where}
       ORDER BY
         ${sortColumn} ${sortDirection} NULLS LAST,
         d.updated_at DESC,
         d.id DESC
       LIMIT $${limitParameter}
       OFFSET $${offsetParameter}`,
      [...filters.parameters, limit, offset],
    ),
    query(
      `SELECT COUNT(*)::INTEGER AS total
       FROM legislative_documents d
       WHERE ${filters.where}`,
      filters.parameters,
    ),
  ]);
  const total = count.rows[0]?.total || 0;
  return {
    gazettes: documents.rows.map(mapGazette),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + limit < total,
    },
  };
};

const getGazetteFilters = async () => {
  const result = await query(
    `SELECT
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT ministry ORDER BY ministry), NULL)
         AS ministries,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT department ORDER BY department), NULL)
         AS departments,
       ARRAY_REMOVE(
         ARRAY_AGG(DISTINCT document_type ORDER BY document_type),
         NULL
       ) AS notification_types,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT category ORDER BY category), NULL)
         AS gazette_types,
       ARRAY_REMOVE(
         ARRAY_AGG(DISTINCT jurisdiction ORDER BY jurisdiction),
         NULL
       ) AS jurisdictions,
       ARRAY_REMOVE(
         ARRAY_AGG(DISTINCT year ORDER BY year DESC),
         NULL
       ) AS years,
       ARRAY_REMOVE(
         ARRAY_AGG(
           DISTINCT COALESCE(canonical_source, source_name)
           ORDER BY COALESCE(canonical_source, source_name)
         ),
         NULL
       ) AS sources
     FROM legislative_documents d
     WHERE ${gazetteScope("d")}`,
  );
  const row = result.rows[0] || {};
  return {
    ministries: row.ministries || [],
    departments: row.departments || [],
    notificationTypes: row.notification_types || GAZETTE_TYPES,
    gazetteTypes: row.gazette_types || [],
    jurisdictions: row.jurisdictions || [],
    years: row.years || [],
    sources: row.sources || [],
  };
};

const getGazetteById = async (id, userId = null) => {
  const document = await query(
    `SELECT d.*
     FROM legislative_documents d
     WHERE d.id = $1 AND ${gazetteScope("d")}
     LIMIT 1`,
    [id],
  );
  if (!document.rows[0]) return null;

  const [resources, relationships, summary] = await Promise.all([
    query(
      `SELECT label, resource_type, category, url, metadata
       FROM legislative_document_resources
       WHERE document_id = $1
       ORDER BY resource_type, label, id`,
      [id],
    ),
    query(
      `SELECT
         r.relationship_type,
         r.confidence,
         r.source_name,
         r.source_url,
         r.metadata_json,
         related.id,
         related.title,
         related.document_type,
         related.jurisdiction,
         related.ministry,
         related.pdf_url,
         COALESCE(
           related.canonical_url,
           related.detail_url,
           related.source_url
         ) AS related_source_url
       FROM document_relationships r
       JOIN legislative_documents related
         ON related.id = CASE
           WHEN r.from_document_id = $1 THEN r.to_document_id
           ELSE r.from_document_id
         END
       WHERE r.from_document_id = $1 OR r.to_document_id = $1
       ORDER BY r.confidence DESC NULLS LAST, related.updated_at DESC
       LIMIT 30`,
      [id],
    ),
    userId
      ? query(
          `SELECT summary
           FROM egazette_chats
           WHERE user_id = $1 AND gazette_id = $2 AND is_active = TRUE
           LIMIT 1`,
          [userId, String(id)],
        )
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    ...mapGazette(document.rows[0]),
    summary: summary.rows[0]?.summary || null,
    resources: resources.rows.map((row) => ({
      label: row.label,
      resourceType: row.resource_type,
      category: row.category,
      url: row.url,
      metadata: row.metadata || {},
    })),
    relationships: relationships.rows.map((row) => ({
      relationshipType: row.relationship_type,
      confidence: row.confidence == null ? null : Number(row.confidence),
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      metadata: row.metadata_json || {},
      document: {
        id: String(row.id),
        title: row.title,
        documentType: row.document_type,
        jurisdiction: row.jurisdiction,
        ministry: row.ministry,
        pdfUrl: row.pdf_url,
        sourceUrl: row.related_source_url,
      },
    })),
  };
};

const getGazetteRecommendations = async (id, limit = 8) => {
  const result = await query(
    `WITH current AS (
       SELECT *
       FROM legislative_documents
       WHERE id = $1 AND ${gazetteScope("legislative_documents")}
       LIMIT 1
     )
     SELECT
       d.*,
       (
         CASE
           WHEN NULLIF(d.ministry, '') = NULLIF(current.ministry, '') THEN 4
           ELSE 0
         END
         + CASE
             WHEN NULLIF(d.authority, '') = NULLIF(current.authority, '') THEN 3
             ELSE 0
           END
         + CASE
             WHEN d.jurisdiction = current.jurisdiction THEN 1
             ELSE 0
           END
       ) AS relationship_score
     FROM legislative_documents d
     CROSS JOIN current
     WHERE d.id <> current.id
       AND (
         (
           current.ministry IS NOT NULL
           AND d.ministry = current.ministry
         )
         OR (
           current.authority IS NOT NULL
           AND d.authority = current.authority
         )
         OR EXISTS (
           SELECT 1
           FROM UNNEST(
             REGEXP_SPLIT_TO_ARRAY(current.normalized_title, '\\s+')
           ) token
           WHERE LENGTH(token) >= 5
             AND d.normalized_title ILIKE ('%' || token || '%')
         )
       )
     ORDER BY
       relationship_score DESC,
       d.source_priority ASC,
       d.publication_date DESC NULLS LAST,
       d.updated_at DESC
     LIMIT $2`,
    [id, clampInteger(limit, 8, 1, 20)],
  );
  return result.rows.map((row) => ({
    ...mapGazette(row),
    relationshipScore: Number(row.relationship_score || 0),
  }));
};

module.exports = {
  GAZETTE_TYPES,
  buildFilters,
  gazetteScope,
  getGazetteById,
  getGazetteFilters,
  getGazetteRecommendations,
  listGazettes,
  mapGazette,
};
