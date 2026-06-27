const { connectDB, getPool, query } = require("../db");

const DOCUMENT_COLUMNS = [
  "source_name",
  "source_document_id",
  "document_type",
  "jurisdiction_level",
  "jurisdiction",
  "title",
  "year",
  "status",
  "ministry",
  "category",
  "source_url",
  "detail_url",
  "pdf_url",
  "source_page_url",
  "source_metadata",
];

const documentValues = (document) => [
  document.sourceName,
  document.sourceDocumentId,
  document.documentType,
  document.jurisdictionLevel,
  document.jurisdiction,
  document.title,
  document.year,
  document.status,
  document.ministry,
  document.category,
  document.sourceUrl,
  document.detailUrl,
  document.pdfUrl,
  document.sourcePageUrl,
  JSON.stringify(document.sourceMetadata || {}),
];

const placeholders = (rowIndex, columns, jsonColumnIndexes = []) => {
  const offset = rowIndex * columns;
  return `(${Array.from({ length: columns }, (_, columnIndex) => {
    const parameter = `$${offset + columnIndex + 1}`;
    return jsonColumnIndexes.includes(columnIndex)
      ? `${parameter}::jsonb`
      : parameter;
  }).join(", ")})`;
};

const chunks = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const createIngestionRun = async (options) => {
  const result = await query(
    `INSERT INTO ingestion_runs (source_name, options)
     VALUES ($1, $2::jsonb)
     RETURNING id, started_at`,
    ["prs-india", JSON.stringify(options || {})],
  );
  return result.rows[0];
};

const completeIngestionRun = async (runId, summary) => {
  await query(
    `UPDATE ingestion_runs
       SET status = $2,
           records_discovered = $3,
           records_stored = $4,
           resources_stored = $5,
           errors = $6::jsonb,
           completed_at = NOW()
     WHERE id = $1`,
    [
      runId,
      summary.status,
      summary.recordsDiscovered || 0,
      summary.recordsStored || 0,
      summary.resourcesStored || 0,
      JSON.stringify(summary.errors || []),
    ],
  );
};

const upsertDocuments = async (documents, batchSize = 100) => {
  if (!documents.length) return new Map();
  await connectDB();
  const client = await getPool().connect();
  const identifiers = new Map();

  try {
    await client.query("BEGIN");

    for (const batch of chunks(documents, batchSize)) {
      const values = batch.flatMap(documentValues);
      const rows = batch.map((_, index) =>
        placeholders(index, DOCUMENT_COLUMNS.length, [14]),
      );
      const result = await client.query(
        `INSERT INTO legislative_documents (${DOCUMENT_COLUMNS.join(", ")})
         VALUES ${rows.join(", ")}
         ON CONFLICT (source_name, source_document_id)
         DO UPDATE SET
           document_type = EXCLUDED.document_type,
           jurisdiction_level = EXCLUDED.jurisdiction_level,
           jurisdiction = EXCLUDED.jurisdiction,
           title = EXCLUDED.title,
           year = COALESCE(EXCLUDED.year, legislative_documents.year),
           status = COALESCE(EXCLUDED.status, legislative_documents.status),
           ministry = COALESCE(EXCLUDED.ministry, legislative_documents.ministry),
           category = COALESCE(EXCLUDED.category, legislative_documents.category),
           source_url = EXCLUDED.source_url,
           detail_url = COALESCE(EXCLUDED.detail_url, legislative_documents.detail_url),
           pdf_url = COALESCE(EXCLUDED.pdf_url, legislative_documents.pdf_url),
           source_page_url = EXCLUDED.source_page_url,
           source_metadata =
             legislative_documents.source_metadata || EXCLUDED.source_metadata,
           last_seen_at = NOW(),
           updated_at = NOW()
         RETURNING id, source_document_id`,
        values,
      );

      for (const row of result.rows) {
        identifiers.set(row.source_document_id, row.id);
      }
    }

    await client.query("COMMIT");
    return identifiers;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const upsertResources = async (
  documents,
  documentIdentifiers,
  batchSize = 200,
) => {
  const resources = [];
  const seen = new Set();

  for (const document of documents) {
    const documentId = documentIdentifiers.get(document.sourceDocumentId);
    if (!documentId) continue;

    for (const resource of document.resources || []) {
      const key = `${documentId}:${resource.url}`;
      if (!resource.url || seen.has(key)) continue;
      seen.add(key);
      resources.push({
        documentId,
        ...resource,
      });
    }
  }

  if (!resources.length) return 0;
  await connectDB();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    for (const batch of chunks(resources, batchSize)) {
      const values = batch.flatMap((resource) => [
        resource.documentId,
        resource.label,
        resource.resourceType || "link",
        resource.category,
        resource.url,
        JSON.stringify(resource.metadata || {}),
      ]);
      const rows = batch.map((_, index) => placeholders(index, 6, [5]));

      await client.query(
        `INSERT INTO legislative_document_resources
           (document_id, label, resource_type, category, url, metadata)
         VALUES ${rows.join(", ")}
         ON CONFLICT (document_id, url)
         DO UPDATE SET
           label = COALESCE(EXCLUDED.label, legislative_document_resources.label),
           resource_type = EXCLUDED.resource_type,
           category = COALESCE(
             EXCLUDED.category,
             legislative_document_resources.category
           ),
           metadata =
             legislative_document_resources.metadata || EXCLUDED.metadata,
           last_seen_at = NOW(),
           updated_at = NOW()`,
        values,
      );
    }
    await client.query("COMMIT");
    return resources.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const storeSnapshots = async (snapshots, batchSize = 100) => {
  if (!snapshots.length) return 0;
  await connectDB();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    for (const batch of chunks(snapshots, batchSize)) {
      const values = batch.flatMap((snapshot) => [
        snapshot.sourceName,
        snapshot.sourceUrl,
        snapshot.contentSha256,
        snapshot.recordCount,
        JSON.stringify(snapshot.metadata || {}),
      ]);
      const rows = batch.map((_, index) => placeholders(index, 5, [4]));
      await client.query(
        `INSERT INTO source_collection_snapshots
           (source_name, source_url, content_sha256, record_count, metadata)
         VALUES ${rows.join(", ")}`,
        values,
      );
    }
    await client.query("COMMIT");
    return snapshots.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getCatalogStats = async () => {
  const result = await query(`
    SELECT
      document_type,
      jurisdiction_level,
      jurisdiction,
      COUNT(*)::INTEGER AS documents,
      COUNT(pdf_url)::INTEGER AS documents_with_pdf,
      COUNT(ministry)::INTEGER AS documents_with_ministry,
      MIN(year) AS earliest_year,
      MAX(year) AS latest_year
    FROM legislative_documents
    GROUP BY document_type, jurisdiction_level, jurisdiction
    ORDER BY jurisdiction_level, document_type, jurisdiction
  `);

  const totals = await query(`
    SELECT
      COUNT(*)::INTEGER AS documents,
      COUNT(pdf_url)::INTEGER AS documents_with_pdf,
      COUNT(DISTINCT jurisdiction)::INTEGER AS jurisdictions,
      (SELECT COUNT(*)::INTEGER FROM legislative_document_resources) AS resources,
      (SELECT COUNT(*)::INTEGER FROM source_collection_snapshots) AS snapshots
    FROM legislative_documents
  `);

  return {
    totals: totals.rows[0],
    coverage: result.rows,
  };
};

module.exports = {
  completeIngestionRun,
  createIngestionRun,
  getCatalogStats,
  storeSnapshots,
  upsertDocuments,
  upsertResources,
};
