const { query } = require("../../db");

const scoreDocumentQuality = ({
  title,
  sourceUrl,
  hasPdf,
  publicationDate,
  year,
  ministry,
  authority,
  jurisdiction,
  accessibleResource,
  duplicateWarning,
  processingSuccess,
  textExtracted,
}) =>
  Math.max(
    0,
    Math.min(
      100,
      (title ? 15 : 0) +
        (sourceUrl ? 15 : 0) +
        (hasPdf ? 15 : 0) +
        (publicationDate || year ? 10 : 0) +
        (ministry || authority ? 10 : 0) +
        (jurisdiction ? 10 : 0) +
        (accessibleResource ? 10 : 0) +
        (processingSuccess ? 10 : 0) +
        (textExtracted ? 5 : 0) -
        (duplicateWarning ? 20 : 0),
    ),
  );

const refreshDataQuality = async () => {
  const result = await query(`
    WITH resource_state AS (
      SELECT
        document_id,
        BOOL_OR(resource_type = 'pdf') AS has_pdf,
        BOOL_OR(
          resource_type IN ('pdf', 'text', 'html') AND is_accessible
        ) AS has_accessible
      FROM document_resources
      GROUP BY document_id
    ),
    dedupe_state AS (
      SELECT document_id, TRUE AS has_warning
      FROM (
        SELECT document_id
        FROM dedupe_candidates
        WHERE status = 'pending'
        UNION
        SELECT candidate_document_id
        FROM dedupe_candidates
        WHERE status = 'pending'
      ) warnings
      GROUP BY document_id
    ),
    quality AS (
      SELECT
        d.id,
        CASE
          WHEN d.metadata_json ->> 'qualityDisposition' = 'invalid_navigation'
            THEN 0
          ELSE LEAST(
          100,
          (CASE WHEN NULLIF(TRIM(d.title), '') IS NOT NULL THEN 15 ELSE 0 END) +
          (CASE WHEN d.canonical_url IS NOT NULL THEN 15 ELSE 0 END) +
          (CASE WHEN resources.has_pdf THEN 15 ELSE 0 END) +
          (CASE WHEN d.publication_date IS NOT NULL OR d.year IS NOT NULL THEN 10 ELSE 0 END) +
          (CASE WHEN d.ministry IS NOT NULL OR d.authority IS NOT NULL THEN 10 ELSE 0 END) +
          (CASE WHEN d.jurisdiction IS NOT NULL THEN 10 ELSE 0 END) +
          (CASE WHEN resources.has_accessible THEN 10 ELSE 0 END) +
          (CASE WHEN ps.processing_status = 'ready' THEN 10 ELSE 0 END) +
          (CASE WHEN ps.extraction_status = 'ready' THEN 5 ELSE 0 END) -
          (CASE WHEN dedupe.has_warning THEN 20 ELSE 0 END)
        )
        END::NUMERIC(5, 2) AS score,
        (
          d.metadata_json ->> 'qualityDisposition' IS DISTINCT FROM
            'invalid_navigation'
          AND
          d.canonical_url IS NOT NULL
          AND COALESCE(resources.has_accessible, FALSE)
          AND ps.processing_status = 'ready'
          AND ps.extraction_status = 'ready'
          AND ps.embedding_status = 'ready'
          AND ps.chunks_count > 0
          AND ps.error_message IS NULL
        ) AS ready
      FROM documents d
      LEFT JOIN document_processing_state ps ON ps.document_id = d.id
      LEFT JOIN resource_state resources ON resources.document_id = d.id
      LEFT JOIN dedupe_state dedupe ON dedupe.document_id = d.id
    )
    UPDATE documents d
    SET quality_score = quality.score,
        research_ready = quality.ready,
        visibility_status = CASE
          WHEN d.metadata_json ->> 'qualityDisposition' = 'invalid_navigation'
            THEN 'hidden_invalid'
          WHEN d.canonical_url IS NULL THEN 'internal_only'
          WHEN quality.score < 40 THEN 'low_quality'
          ELSE 'public'
        END,
        updated_at = GREATEST(d.updated_at, NOW())
    FROM quality
    WHERE quality.id = d.id
    RETURNING d.id, d.quality_score, d.research_ready, d.visibility_status
  `);

  await query(`
    INSERT INTO dashboard_metrics (metric_key, metric_value, measured_at)
    VALUES
      ('documents.total', (SELECT COUNT(*) FROM documents), NOW()),
      ('documents.research_ready', (SELECT COUNT(*) FROM documents WHERE research_ready), NOW()),
      ('documents.high_quality', (SELECT COUNT(*) FROM documents WHERE quality_score >= 70), NOW()),
      ('documents.low_quality', (SELECT COUNT(*) FROM documents WHERE quality_score < 40), NOW()),
      ('sources.fresh', (SELECT COUNT(*) FROM source_health WHERE status IN ('fresh', 'connected')), NOW())
    ON CONFLICT (metric_key) DO UPDATE SET
      metric_value = EXCLUDED.metric_value,
      measured_at = EXCLUDED.measured_at
  `);

  return {
    updated: result.rowCount,
    researchReady: result.rows.filter((row) => row.research_ready).length,
    lowQuality: result.rows.filter(
      (row) => row.visibility_status === "low_quality",
    ).length,
  };
};

module.exports = {
  refreshDataQuality,
  scoreDocumentQuality,
};
