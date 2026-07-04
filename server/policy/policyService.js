const { query } = require("../db");

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const policyScope = (alias = "d") => `(
  ${alias}.source_name = 'policyedge'
  AND ${alias}.document_type = 'policy'
)`;

const mergeMetadata = (row) => ({
  ...(row.source_metadata || {}),
  ...(row.metadata_json || {}),
});

const mapPolicy = (row) => {
  if (!row) return null;
  const metadata = mergeMetadata(row);
  return {
    id: String(row.id),
    canonicalId: row.canonical_id,
    title: row.title,
    category: row.category || metadata.category || "Reports/Data Releases",
    ministry: row.ministry,
    department: row.department,
    authority: row.authority,
    publicationDate: row.publication_date,
    year: row.year,
    jurisdiction: row.jurisdiction,
    jurisdictionLevel: row.jurisdiction_level,
    sourceName: row.canonical_source || row.source_name,
    sourceUrl: row.canonical_url || row.detail_url || row.source_url,
    pdfUrl: row.pdf_url,
    status: row.status || "Published",
    hasPdf: Boolean(row.pdf_url),
    metadata,
    firstSeenAt: row.first_seen_at,
    updatedAt: row.updated_at,
  };
};

const buildFilters = (options = {}) => {
  const parameters = [];
  const conditions = [policyScope("d")];
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
      OR COALESCE(d.ministry, '') ILIKE ${parameter}
      OR COALESCE(d.department, '') ILIKE ${parameter}
      OR COALESCE(d.authority, '') ILIKE ${parameter}
      OR COALESCE(d.category, '') ILIKE ${parameter}
      OR COALESCE(d.source_metadata::TEXT, '') ILIKE ${parameter}
      OR COALESCE(d.metadata_json::TEXT, '') ILIKE ${parameter}
      ${indexedIds ? `OR d.id::TEXT = ANY(${indexedIds}::TEXT[])` : ""}
    )`);
  }

  if (options.category) {
    conditions.push(`d.category ILIKE ${add(`%${options.category}%`)}`);
  }

  if (options.year) {
    conditions.push(`d.year = ${add(Number.parseInt(options.year, 10))}`);
  }

  if (options.jurisdiction) {
    conditions.push(`d.jurisdiction = ${add(options.jurisdiction)}`);
  }

  return { conditions, parameters };
};

const listPolicies = async (options = {}) => {
  const page = clampInteger(options.page, 1, 1, 10_000);
  const limit = clampInteger(options.limit, 20, 1, 100);
  const offset = (page - 1) * limit;
  const { conditions, parameters } = buildFilters(options);

  const sortBy = options.sortBy === "title" ? "d.title" : "d.publication_date";
  const sortDirection =
    String(options.sortDirection || "").toUpperCase() === "ASC" ? "ASC" : "DESC";

  const where = conditions.join(" AND ");
  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM legislative_documents d WHERE ${where}`,
    parameters,
  );
  const total = countResult.rows[0]?.total || 0;

  const dataResult = await query(
    `SELECT d.*
     FROM legislative_documents d
     WHERE ${where}
     ORDER BY ${sortBy} ${sortDirection} NULLS LAST, d.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    parameters,
  );

  return {
    policies: dataResult.rows.map(mapPolicy),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
};

const getPolicyById = async (id) => {
  const result = await query(
    `SELECT d.*
     FROM legislative_documents d
     WHERE d.id = $1 AND ${policyScope("d")}
     LIMIT 1`,
    [id],
  );
  return mapPolicy(result.rows[0]);
};

const getPolicyFilters = async () => {
  const result = await query(
    `SELECT
       ARRAY_AGG(DISTINCT d.category) FILTER (WHERE d.category IS NOT NULL) AS categories,
       ARRAY_AGG(DISTINCT d.year) FILTER (WHERE d.year IS NOT NULL) AS years,
       ARRAY_AGG(DISTINCT d.jurisdiction) FILTER (WHERE d.jurisdiction IS NOT NULL) AS jurisdictions
     FROM legislative_documents d
     WHERE ${policyScope("d")}`,
  );
  const row = result.rows[0] || {};
  return {
    categories: (row.categories || []).sort(),
    years: (row.years || []).sort((a, b) => b - a),
    jurisdictions: (row.jurisdictions || []).sort(),
  };
};

module.exports = {
  getPolicyById,
  getPolicyFilters,
  listPolicies,
};
