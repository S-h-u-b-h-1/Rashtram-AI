const { query } = require("../db");

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const mapDocument = (row) => ({
  id: String(row.id),
  title: row.title,
  link: row.detail_url || row.source_url,
  status:
    row.status ||
    (row.document_type === "act" ? "Active" : "Unknown"),
  year: row.year,
  pdf: row.pdf_url,
  ministry: row.ministry,
  category: row.category,
  jurisdiction: row.jurisdiction,
  jurisdictionLevel: row.jurisdiction_level,
  source: row.source_name,
});

const buildFilters = ({
  documentType,
  jurisdictionLevel = "parliament",
  jurisdiction,
  search,
  status,
  year,
}) => {
  const parameters = [documentType, jurisdictionLevel];
  const conditions = [
    `document_type = $1`,
    `jurisdiction_level = $2`,
  ];

  if (jurisdiction) {
    parameters.push(jurisdiction);
    conditions.push(`jurisdiction = $${parameters.length}`);
  }
  if (search) {
    parameters.push(`%${search}%`);
    conditions.push(`title ILIKE $${parameters.length}`);
  }
  if (status && status !== "All") {
    parameters.push(status);
    conditions.push(`status = $${parameters.length}`);
  }
  if (year && year !== "All") {
    parameters.push(Number.parseInt(year, 10));
    conditions.push(`year = $${parameters.length}`);
  }

  return {
    parameters,
    where: conditions.join(" AND "),
  };
};

const listDocuments = async (options) => {
  const page = clampInteger(options.page, 1, 1, 100_000);
  const limit = clampInteger(options.limit, 10, 1, 100);
  const offset = (page - 1) * limit;
  const filters = buildFilters(options);
  const limitParameter = filters.parameters.length + 1;
  const offsetParameter = filters.parameters.length + 2;

  const [documentsResult, countResult] = await Promise.all([
    query(
      `SELECT *
         FROM legislative_documents
        WHERE ${filters.where}
        ORDER BY
          year DESC NULLS LAST,
          (source_metadata->>'listPosition')::INTEGER ASC NULLS LAST,
          title ASC
        LIMIT $${limitParameter}
       OFFSET $${offsetParameter}`,
      [...filters.parameters, limit, offset],
    ),
    query(
      `SELECT COUNT(*)::INTEGER AS total
         FROM legislative_documents
        WHERE ${filters.where}`,
      filters.parameters,
    ),
  ]);

  const total = countResult.rows[0]?.total || 0;
  return {
    documents: documentsResult.rows.map(mapDocument),
    pagination: {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getStatuses = async (documentType = "bill") => {
  const result = await query(
    `SELECT DISTINCT status
       FROM legislative_documents
      WHERE document_type = $1
        AND jurisdiction_level = 'parliament'
        AND status IS NOT NULL
        AND status <> ''
      ORDER BY status`,
    [documentType],
  );
  return result.rows.map((row) => row.status);
};

const getYears = async (documentType = "act") => {
  const result = await query(
    `SELECT DISTINCT year
       FROM legislative_documents
      WHERE document_type = $1
        AND jurisdiction_level = 'parliament'
        AND year IS NOT NULL
      ORDER BY year DESC`,
    [documentType],
  );
  return result.rows.map((row) => row.year);
};

const getDocumentById = async (id, documentType) => {
  const result = await query(
    `SELECT *
       FROM legislative_documents
      WHERE id = $1 AND document_type = $2
      LIMIT 1`,
    [id, documentType],
  );
  return result.rows[0] ? mapDocument(result.rows[0]) : null;
};

const findDocumentBySourceUrl = async (sourceUrl, documentType) => {
  const result = await query(
    `SELECT *
       FROM legislative_documents
      WHERE document_type = $1
        AND ($2 = source_url OR $2 = detail_url OR $2 = pdf_url)
      LIMIT 1`,
    [documentType, sourceUrl],
  );
  return result.rows[0] ? mapDocument(result.rows[0]) : null;
};

const updateDocumentPdf = async (id, pdfUrl) => {
  await query(
    `UPDATE legislative_documents
        SET pdf_url = $2, updated_at = NOW()
      WHERE id = $1`,
    [id, pdfUrl],
  );
};

module.exports = {
  findDocumentBySourceUrl,
  getDocumentById,
  getStatuses,
  getYears,
  listDocuments,
  mapDocument,
  updateDocumentPdf,
};
