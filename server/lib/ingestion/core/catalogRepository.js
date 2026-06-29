const crypto = require("crypto");
const { connectDB, getPool, query } = require("../../../db");

const createRun = async ({ sourceName, collectionName, options = {} }) => {
  const result = await query(
    `INSERT INTO ingestion_runs (
       source_name, collection_name, options, counters_json, errors_json
     )
     VALUES ($1, $2, $3::jsonb, '{}'::jsonb, '[]'::jsonb)
     RETURNING id, started_at`,
    [sourceName, collectionName || null, JSON.stringify(options)],
  );
  return result.rows[0];
};

const completeRun = async (runId, summary) => {
  const errors = summary.errors || [];
  await query(
    `UPDATE ingestion_runs
        SET status = $2,
            records_discovered = $3,
            records_stored = $4,
            resources_stored = $5,
            counters_json = $6::jsonb,
            errors = $7::jsonb,
            errors_json = $7::jsonb,
            completed_at = NOW()
      WHERE id = $1`,
    [
      runId,
      summary.status,
      summary.discovered || 0,
      summary.stored || 0,
      summary.resources || 0,
      JSON.stringify(summary.counters || {}),
      JSON.stringify(errors),
    ],
  );
};

const findCandidates = async (record) => {
  const identifiers = [
    record.legalIdentifier,
    record.gazetteIdentifier,
    record.actNumber,
    record.billNumber,
  ].filter(Boolean);
  const titleAnchor =
    record.normalizedTitle
      .split(" ")
      .find((token) => token.length >= 4) || record.normalizedTitle;
  const result = await query(
    `SELECT DISTINCT
       d.*,
       s.source_name AS source_name,
       s.source_record_id AS source_record_id
     FROM legislative_documents d
     LEFT JOIN document_sources s ON s.document_id = d.id
     WHERE (s.source_name = $1 AND s.source_record_id = $2)
        OR ($3::TEXT[] <> '{}'::TEXT[] AND (
             d.legal_identifier = ANY($3::TEXT[])
          OR d.gazette_identifier = ANY($3::TEXT[])
          OR d.act_number = ANY($3::TEXT[])
          OR d.bill_number = ANY($3::TEXT[])
        ))
        OR ($4::TEXT IS NOT NULL AND d.content_hash = $4)
        OR ($5::TEXT IS NOT NULL AND d.text_fingerprint = $5)
        OR (
          d.normalized_title = $6
          AND ($7::INTEGER IS NULL OR d.year = $7)
          AND d.jurisdiction = $8
          AND d.document_type = $9
        )
        OR (
          $7::INTEGER IS NOT NULL
          AND d.year = $7
          AND d.jurisdiction = $8
          AND d.document_type = $9
          AND d.normalized_title ILIKE ('%' || $10 || '%')
        )
     ORDER BY d.source_priority ASC, d.id ASC
     LIMIT 100`,
    [
      record.sourceName,
      record.sourceRecordId,
      identifiers,
      record.contentHash,
      record.textFingerprint,
      record.normalizedTitle,
      record.year,
      record.jurisdiction,
      record.documentType,
      titleAnchor,
    ],
  );
  return result.rows;
};

const documentInsertValues = (record) => [
  crypto.randomUUID(),
  record.sourceName,
  record.sourceRecordId,
  record.documentType,
  record.jurisdictionLevel,
  record.jurisdiction,
  record.title,
  record.normalizedTitle,
  record.year,
  record.status,
  record.authority,
  record.ministry,
  record.department,
  record.category,
  record.legalIdentifier,
  record.billNumber,
  record.actNumber,
  record.gazetteIdentifier,
  record.gazetteIdentifier,
  record.introducedDate,
  record.passedDate,
  record.enactedDate,
  record.assentDate || record.enactedDate,
  record.publicationDate,
  record.effectiveDate,
  record.commencementDate || record.effectiveDate,
  record.sourceUrl,
  record.detailUrl,
  record.pdfUrl,
  record.sourceUrl,
  JSON.stringify(record.sourceMetadata || {}),
  record.sourceName,
  record.detailUrl || record.sourceUrl,
  record.sourcePriority,
  record.contentHash,
  record.textFingerprint,
  JSON.stringify(record.metadata || {}),
];

const insertDocument = async (client, record) => {
  const result = await client.query(
    `INSERT INTO legislative_documents (
       canonical_id,
       source_name,
       source_document_id,
       document_type,
       jurisdiction_level,
       jurisdiction,
       title,
       normalized_title,
       year,
       status,
       authority,
       ministry,
       department,
       category,
       legal_identifier,
       bill_number,
       act_number,
       gazette_identifier,
       gazette_id,
       introduced_date,
       passed_date,
       enacted_date,
       assent_date,
       publication_date,
       effective_date,
       commencement_date,
       source_url,
       detail_url,
       pdf_url,
       source_page_url,
       source_metadata,
       canonical_source,
       canonical_url,
       source_priority,
       content_hash,
       text_fingerprint,
       metadata_json
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
       $27, $28, $29, $30, $31::jsonb, $32, $33, $34, $35, $36,
       $37::jsonb
     )
     RETURNING *`,
    documentInsertValues(record),
  );
  return result.rows[0];
};

const updateCanonicalDocument = async (client, documentId, record) => {
  const result = await client.query(
    `UPDATE legislative_documents
        SET title = CASE WHEN $2 < source_priority OR title IS NULL
                         THEN $3 ELSE title END,
            normalized_title = CASE
              WHEN $2 < source_priority OR normalized_title IS NULL
              THEN $4 ELSE normalized_title END,
            document_type = CASE
              WHEN $2 < source_priority THEN $5 ELSE document_type END,
            jurisdiction_level = CASE
              WHEN $2 < source_priority THEN $6 ELSE jurisdiction_level END,
            jurisdiction = CASE
              WHEN $2 < source_priority THEN $7 ELSE jurisdiction END,
            year = CASE WHEN $2 < source_priority OR year IS NULL
                        THEN COALESCE($8, year) ELSE year END,
            status = CASE WHEN $2 < source_priority OR status IS NULL
                          THEN COALESCE($9, status) ELSE status END,
            authority = CASE WHEN $2 < source_priority OR authority IS NULL
                             THEN COALESCE($10, authority) ELSE authority END,
            ministry = CASE WHEN $2 < source_priority OR ministry IS NULL
                            THEN COALESCE($11, ministry) ELSE ministry END,
            department = CASE WHEN $2 < source_priority OR department IS NULL
                              THEN COALESCE($12, department) ELSE department END,
            category = CASE WHEN $2 < source_priority OR category IS NULL
                            THEN COALESCE($13, category) ELSE category END,
            legal_identifier = COALESCE(legal_identifier, $14),
            bill_number = COALESCE(bill_number, $15),
            act_number = COALESCE(act_number, $16),
            gazette_identifier = COALESCE(gazette_identifier, $17),
            gazette_id = COALESCE(gazette_id, $17),
            introduced_date = COALESCE(introduced_date, $18),
            passed_date = COALESCE(passed_date, $19),
            enacted_date = COALESCE(enacted_date, $20),
            assent_date = COALESCE(assent_date, $20),
            publication_date = COALESCE(publication_date, $21),
            effective_date = COALESCE(effective_date, $22),
            commencement_date = COALESCE(commencement_date, $22),
            pdf_url = CASE WHEN $2 < source_priority OR pdf_url IS NULL
                           THEN COALESCE($23, pdf_url) ELSE pdf_url END,
            content_hash = COALESCE(content_hash, $24),
            text_fingerprint = COALESCE(text_fingerprint, $25),
            canonical_source = CASE WHEN $2 < source_priority
                                    THEN $26 ELSE canonical_source END,
            canonical_url = CASE WHEN $2 < source_priority
                                 THEN $27 ELSE canonical_url END,
            source_priority = LEAST(source_priority, $2),
            metadata_json = metadata_json || $28::jsonb,
            last_seen_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [
      documentId,
      record.sourcePriority,
      record.title,
      record.normalizedTitle,
      record.documentType,
      record.jurisdictionLevel,
      record.jurisdiction,
      record.year,
      record.status,
      record.authority,
      record.ministry,
      record.department,
      record.category,
      record.legalIdentifier,
      record.billNumber,
      record.actNumber,
      record.gazetteIdentifier,
      record.introducedDate,
      record.passedDate,
      record.enactedDate,
      record.publicationDate,
      record.effectiveDate,
      record.pdfUrl,
      record.contentHash,
      record.textFingerprint,
      record.sourceName,
      record.detailUrl || record.sourceUrl,
      JSON.stringify(record.metadata || {}),
    ],
  );
  return result.rows[0];
};

const upsertSource = async (client, documentId, record) => {
  const existing = await client.query(
    `SELECT document_id
       FROM document_sources
      WHERE source_name = $1 AND source_record_id = $2
      FOR UPDATE`,
    [record.sourceName, record.sourceRecordId],
  );
  await client.query(
    `INSERT INTO document_sources (
       document_id,
       source_name,
       source_record_id,
       source_url,
       detail_url,
       pdf_url,
       source_priority,
       legal_identifier,
       content_hash,
       pdf_hash,
       html_hash,
       text_fingerprint,
       source_title,
       source_status,
       raw_metadata,
       source_metadata
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15::jsonb, $15::jsonb
     )
     ON CONFLICT (source_name, source_record_id)
     DO UPDATE SET
       document_id = EXCLUDED.document_id,
       source_url = EXCLUDED.source_url,
       detail_url = COALESCE(EXCLUDED.detail_url, document_sources.detail_url),
       pdf_url = COALESCE(EXCLUDED.pdf_url, document_sources.pdf_url),
       source_priority = EXCLUDED.source_priority,
       legal_identifier = COALESCE(
         EXCLUDED.legal_identifier,
         document_sources.legal_identifier
       ),
       content_hash = COALESCE(
         EXCLUDED.content_hash,
         document_sources.content_hash
       ),
       pdf_hash = COALESCE(EXCLUDED.pdf_hash, document_sources.pdf_hash),
       html_hash = COALESCE(EXCLUDED.html_hash, document_sources.html_hash),
       text_fingerprint = COALESCE(
         EXCLUDED.text_fingerprint,
         document_sources.text_fingerprint
       ),
       source_title = COALESCE(
         EXCLUDED.source_title,
         document_sources.source_title
       ),
       source_status = COALESCE(
         EXCLUDED.source_status,
         document_sources.source_status
       ),
       raw_metadata = document_sources.raw_metadata || EXCLUDED.raw_metadata,
       source_metadata =
         document_sources.source_metadata || EXCLUDED.source_metadata,
       last_seen_at = NOW(),
       updated_at = NOW()`,
    [
      documentId,
      record.sourceName,
      record.sourceRecordId,
      record.sourceUrl,
      record.detailUrl,
      record.pdfUrl,
      record.sourcePriority,
      record.legalIdentifier,
      record.contentHash,
      record.pdfHash,
      record.htmlHash,
      record.textFingerprint,
      record.sourceTitle || record.title,
      record.sourceStatus || record.status,
      JSON.stringify(record.sourceMetadata || {}),
    ],
  );
  return {
    added: existing.rowCount === 0,
    previousDocumentId: existing.rows[0]?.document_id || null,
  };
};

const upsertResources = async (client, documentId, resources) => {
  let stored = 0;
  for (const resource of resources || []) {
    if (!resource.url) continue;
    await client.query(
      `INSERT INTO legislative_document_resources (
         document_id, label, resource_type, category, url, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (document_id, url)
       DO UPDATE SET
         label = COALESCE(EXCLUDED.label, legislative_document_resources.label),
         resource_type = EXCLUDED.resource_type,
         category = COALESCE(
           EXCLUDED.category,
           legislative_document_resources.category
         ),
         metadata = legislative_document_resources.metadata || EXCLUDED.metadata,
         last_seen_at = NOW(),
         updated_at = NOW()`,
      [
        documentId,
        resource.label || null,
        resource.resourceType || "link",
        resource.category || null,
        resource.url,
        JSON.stringify(resource.metadata || {}),
      ],
    );
    stored += 1;
  }
  return stored;
};

const upsertRelationships = async (client, documentId, record) => {
  let stored = 0;
  for (const relationship of record.relationships || []) {
    let target;
    if (relationship.toSourceName && relationship.toSourceRecordId) {
      target = await client.query(
        `SELECT document_id AS id
         FROM document_sources
         WHERE source_name = $1 AND source_record_id = $2
         LIMIT 1`,
        [relationship.toSourceName, relationship.toSourceRecordId],
      );
    } else if (relationship.toLegalIdentifier) {
      target = await client.query(
        `SELECT id
         FROM legislative_documents
         WHERE legal_identifier = $1
           AND jurisdiction = $2
         ORDER BY source_priority, id
         LIMIT 1`,
        [relationship.toLegalIdentifier, record.jurisdiction],
      );
    }
    const targetId = target?.rows[0]?.id;
    if (!targetId || Number(targetId) === Number(documentId)) continue;
    await client.query(
      `INSERT INTO document_relationships (
         from_document_id,
         to_document_id,
         relationship_type,
         source_name,
         source_url,
         confidence,
         metadata,
         metadata_json
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $7::jsonb)
       ON CONFLICT (from_document_id, to_document_id, relationship_type)
       DO UPDATE SET
         source_name = COALESCE(
           EXCLUDED.source_name,
           document_relationships.source_name
         ),
         source_url = COALESCE(
           EXCLUDED.source_url,
           document_relationships.source_url
         ),
         confidence = COALESCE(
           EXCLUDED.confidence,
           document_relationships.confidence
         ),
         metadata = document_relationships.metadata || EXCLUDED.metadata,
         metadata_json =
           document_relationships.metadata_json || EXCLUDED.metadata_json,
         updated_at = NOW()`,
      [
        documentId,
        targetId,
        relationship.type || "related_to",
        record.sourceName,
        relationship.sourceUrl || record.detailUrl || record.sourceUrl,
        relationship.confidence || null,
        JSON.stringify(relationship.metadata || {}),
      ],
    );
    stored += 1;
  }
  return stored;
};

const eventTypeForRecord = (record) => {
  if (
    ["egazette", "state-gazette"].includes(record.sourceName) &&
    ["gazette", "notification"].includes(record.documentType)
  ) {
    return "gazette_notification";
  }
  if (record.documentType === "bill" && record.introducedDate) {
    return "bill_introduced";
  }
  const types = {
    act: "act_published",
    rule: "rule_published",
    ordinance: "ordinance_published",
    committee_report: "committee_report_published",
    debate: "debate_published",
    question: "question_published",
    policy: "ministry_policy_published",
  };
  return types[record.documentType] || "document_added";
};

const updateEventTypeForRecord = (candidate, record) => {
  if (
    record.documentType === "bill" &&
    record.status &&
    String(record.status) !== String(candidate?.status || "")
  ) {
    return "bill_status_changed";
  }
  return "document_updated";
};

const recordIntelligenceEvent = async (
  client,
  document,
  record,
  eventTypeOverride = null,
) => {
  const eventType = eventTypeOverride || eventTypeForRecord(record);
  const eventDate =
    record.publicationDate ||
    record.enactedDate ||
    record.introducedDate ||
    null;
  const importanceScore =
    record.sourceName === "egazette"
      ? 90
      : record.sourceName === "india-code"
        ? 80
        : record.documentType === "bill"
          ? 65
          : 50;
  await client.query(
    `INSERT INTO intelligence_events (
       event_key,
       event_type,
       title,
       document_id,
       source_name,
       source_url,
       document_type,
       jurisdiction,
       authority,
       ministry,
       category,
       status,
       event_date,
       importance_score,
       metadata_json
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15::jsonb
     )
     ON CONFLICT (event_key)
     DO UPDATE SET
       title = EXCLUDED.title,
       source_url = EXCLUDED.source_url,
       status = COALESCE(EXCLUDED.status, intelligence_events.status),
       metadata_json =
         intelligence_events.metadata_json || EXCLUDED.metadata_json,
       last_seen_at = NOW(),
       updated_at = NOW()`,
    [
      `${record.sourceName}:${record.sourceRecordId}:${eventType}`,
      eventType,
      record.title,
      document.id,
      record.sourceName,
      record.detailUrl || record.sourceUrl,
      record.documentType,
      record.jurisdiction,
      record.authority,
      record.ministry,
      record.category,
      record.status,
      eventDate,
      importanceScore,
      JSON.stringify({
        origin: "source-ingestion",
        sourceRecordId: record.sourceRecordId,
      }),
    ],
  );
};

const hasMeaningfulDocumentUpdate = (candidate, record) => {
  if (!candidate) return false;
  const fields = [
    ["title", "title"],
    ["status", "status"],
    ["pdfUrl", "pdf_url"],
    ["introducedDate", "introduced_date"],
    ["passedDate", "passed_date"],
    ["enactedDate", "enacted_date"],
    ["publicationDate", "publication_date"],
    ["effectiveDate", "effective_date"],
  ];
  return fields.some(([recordKey, candidateKey]) => {
    const incoming = record[recordKey];
    if (incoming == null || incoming === "") return false;
    const current = candidate[candidateKey];
    return String(incoming) !== String(current ?? "");
  });
};

const queueReview = async (client, record, candidate, similarity) => {
  await client.query(
    `INSERT INTO catalog_match_reviews (
       incoming_source_name,
       incoming_source_record_id,
       candidate_document_id,
       similarity,
       incoming_record
     )
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (
       incoming_source_name,
       incoming_source_record_id,
       candidate_document_id
     )
     DO UPDATE SET
       similarity = EXCLUDED.similarity,
       incoming_record = EXCLUDED.incoming_record`,
    [
      record.sourceName,
      record.sourceRecordId,
      candidate.id,
      similarity,
      JSON.stringify(record),
    ],
  );
};

const persistRecord = async (record, decision) => {
  await connectDB();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const meaningfulUpdate =
      decision.action === "merge" &&
      hasMeaningfulDocumentUpdate(decision.candidate, record);
    let document;
    if (decision.action === "merge" && decision.candidate) {
      document = await updateCanonicalDocument(
        client,
        decision.candidate.id,
        record,
      );
    } else {
      document = await insertDocument(client, record);
    }
    const source = await upsertSource(client, document.id, record);
    const resources = await upsertResources(
      client,
      document.id,
      record.resources,
    );
    const relationships = await upsertRelationships(
      client,
      document.id,
      record,
    );
    if (decision.action !== "merge") {
      await recordIntelligenceEvent(client, document, record);
    } else if (meaningfulUpdate) {
      await recordIntelligenceEvent(
        client,
        document,
        record,
        updateEventTypeForRecord(decision.candidate, record),
      );
    }
    if (decision.action === "review" && decision.candidate) {
      await queueReview(
        client,
        record,
        decision.candidate,
        decision.similarity,
      );
    }
    await client.query("COMMIT");
    return {
      documentId: document.id,
      canonicalId: document.canonical_id,
      resources,
      relationships,
      action: decision.action === "merge" ? "merged" : "created",
      matchReason: decision.reason,
      reviewQueued: decision.action === "review",
      sourceAdded: source.added,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const findExistingDocument = async (record) =>
  (await findCandidates(record))[0] || null;

const upsertCanonicalDocument = async (client, record, documentId = null) =>
  documentId
    ? updateCanonicalDocument(client, documentId, record)
    : insertDocument(client, record);

const upsertDocumentSource = upsertSource;
const recordIngestionRun = createRun;

const storeSnapshots = async (snapshots) => {
  for (const snapshot of snapshots || []) {
    await query(
      `INSERT INTO source_collection_snapshots (
         source_name,
         source_url,
         content_sha256,
         html_hash,
         response_status,
         record_count,
         metadata,
         metadata_json,
         fetched_at,
         collected_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7::jsonb, $7::jsonb,
         COALESCE($8::TIMESTAMPTZ, NOW()),
         COALESCE($8::TIMESTAMPTZ, NOW())
       )`,
      [
        snapshot.sourceName,
        snapshot.sourceUrl,
        snapshot.contentSha256 || snapshot.htmlHash,
        snapshot.htmlHash || snapshot.contentSha256,
        snapshot.responseStatus || null,
        snapshot.recordCount || 0,
        JSON.stringify(snapshot.metadata || {}),
        snapshot.collectedAt || null,
      ],
    );
  }
  return snapshots?.length || 0;
};

const recordSourceSnapshot = async (snapshot) => storeSnapshots([snapshot]);

const getUniversalStats = async () => {
  const [
    totals,
    bySource,
    byType,
    byJurisdiction,
    byYear,
    reviews,
    duplicates,
  ] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::INTEGER AS documents,
        COUNT(pdf_url)::INTEGER AS documents_with_pdf,
        COUNT(DISTINCT jurisdiction)::INTEGER AS jurisdictions,
        COUNT(DISTINCT canonical_source)::INTEGER AS canonical_sources
      FROM legislative_documents
    `),
    query(`
      SELECT
        source_name,
        COUNT(*)::INTEGER AS source_records,
        COUNT(pdf_url)::INTEGER AS records_with_pdf,
        COUNT(pdf_hash)::INTEGER AS records_with_pdf_hash,
        COUNT(html_hash)::INTEGER AS records_with_html_hash
      FROM document_sources
      GROUP BY source_name
      ORDER BY source_records DESC, source_name
    `),
    query(`
      SELECT document_type, COUNT(*)::INTEGER AS documents
      FROM legislative_documents
      GROUP BY document_type
      ORDER BY documents DESC, document_type
    `),
    query(`
      SELECT
        jurisdiction_level,
        jurisdiction,
        COUNT(*)::INTEGER AS documents
      FROM legislative_documents
      GROUP BY jurisdiction_level, jurisdiction
      ORDER BY documents DESC, jurisdiction_level, jurisdiction
    `),
    query(`
      SELECT year, COUNT(*)::INTEGER AS documents
      FROM legislative_documents
      WHERE year IS NOT NULL
      GROUP BY year
      ORDER BY year DESC
    `),
    query(`
      SELECT status, COUNT(*)::INTEGER AS matches
      FROM catalog_match_reviews
      GROUP BY status
      ORDER BY status
    `),
    query(`
      SELECT
        COUNT(*)::INTEGER AS probable_duplicate_groups,
        COALESCE(SUM(documents), 0)::INTEGER
          AS documents_in_probable_groups
      FROM (
        SELECT COUNT(*)::INTEGER AS documents
        FROM legislative_documents
        WHERE normalized_title IS NOT NULL
        GROUP BY normalized_title, year, jurisdiction, document_type
        HAVING COUNT(*) > 1
      ) duplicate_groups
    `),
  ]);
  return {
    totals: totals.rows[0],
    bySource: bySource.rows,
    byType: byType.rows,
    byJurisdiction: byJurisdiction.rows,
    byYear: byYear.rows,
    duplicateStatus: duplicates.rows[0],
    matchReviews: reviews.rows,
  };
};

const getDuplicateCandidates = async (limit = 100) => {
  const result = await query(
    `SELECT
       normalized_title,
       year,
       jurisdiction,
       document_type,
       COUNT(*)::INTEGER AS documents,
       JSON_AGG(
         JSON_BUILD_OBJECT(
           'id', id,
           'canonicalId', canonical_id,
           'title', title,
           'source', canonical_source
         )
         ORDER BY source_priority, id
       ) AS candidates
     FROM legislative_documents
     WHERE normalized_title IS NOT NULL
     GROUP BY normalized_title, year, jurisdiction, document_type
     HAVING COUNT(*) > 1
     ORDER BY documents DESC, normalized_title
     LIMIT $1`,
    [limit],
  );
  return result.rows;
};

const getPendingReviews = async (limit = 100) => {
  const result = await query(
    `SELECT
       r.id,
       r.incoming_source_name,
       r.incoming_source_record_id,
       r.similarity,
       r.incoming_record,
       d.id AS candidate_document_id,
       d.canonical_id,
       d.title AS candidate_title,
       d.canonical_source
     FROM catalog_match_reviews r
     JOIN legislative_documents d ON d.id = r.candidate_document_id
     WHERE r.status = 'pending'
     ORDER BY r.similarity DESC, r.created_at
     LIMIT $1`,
    [limit],
  );
  return result.rows;
};

const repairCrossTypeIndiaCodeMerges = async () => {
  await connectDB();
  const candidates = await query(`
    SELECT
      d.*,
      india.source_record_id AS india_source_record_id,
      india.source_url AS india_source_url,
      india.detail_url AS india_detail_url,
      india.pdf_url AS india_pdf_url,
      india.legal_identifier AS india_legal_identifier,
      india.content_hash AS india_content_hash,
      india.text_fingerprint AS india_text_fingerprint,
      india.raw_metadata AS india_raw_metadata,
      prs.source_url AS prs_source_url,
      prs.detail_url AS prs_detail_url,
      prs.pdf_url AS prs_pdf_url
    FROM legislative_documents d
    JOIN document_sources india
      ON india.document_id = d.id
     AND india.source_name = 'india-code'
    JOIN document_sources prs
      ON prs.document_id = d.id
     AND prs.source_name = 'prs-india'
    WHERE d.source_name = 'prs-india'
      AND d.document_type = 'act'
      AND (
        d.source_url ILIKE '%/billtrack/%'
        OR d.detail_url ILIKE '%/billtrack/%'
      )
    ORDER BY d.id
  `);
  const repairs = [];

  for (const row of candidates.rows) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const actRecord = {
        sourceName: "india-code",
        sourceRecordId: row.india_source_record_id,
        sourceUrl: row.india_source_url,
        detailUrl: row.india_detail_url,
        pdfUrl: row.india_pdf_url,
        documentType: "act",
        jurisdictionLevel: row.jurisdiction_level,
        jurisdiction: row.jurisdiction,
        title: row.title,
        normalizedTitle: row.normalized_title,
        year: row.year,
        status: row.status,
        authority: row.authority,
        ministry: row.ministry,
        department: row.department,
        category: row.category,
        legalIdentifier: row.india_legal_identifier || row.legal_identifier,
        billNumber: null,
        actNumber: row.act_number,
        gazetteIdentifier: null,
        introducedDate: null,
        passedDate: null,
        enactedDate: row.enacted_date,
        publicationDate: row.publication_date,
        effectiveDate: row.effective_date,
        sourcePriority: 20,
        contentHash: row.india_content_hash || row.content_hash,
        textFingerprint:
          row.india_text_fingerprint || row.text_fingerprint,
        sourceMetadata: row.india_raw_metadata || {},
        metadata: row.metadata_json || {},
      };
      const act = await insertDocument(client, actRecord);

      await client.query(
        `UPDATE document_sources
            SET document_id = $1, updated_at = NOW()
          WHERE source_name = 'india-code'
            AND source_record_id = $2`,
        [act.id, row.india_source_record_id],
      );
      await client.query(
        `UPDATE legislative_document_resources
            SET document_id = $1, updated_at = NOW()
          WHERE document_id = $2
            AND url ILIKE '%indiacode.nic.in%'`,
        [act.id, row.id],
      );
      await client.query(
        `UPDATE legislative_documents
            SET document_type = 'bill',
                title = REGEXP_REPLACE(title, '\\mAct\\M', 'Bill', 'i'),
                canonical_source = 'prs-india',
                canonical_url = COALESCE($2, $3),
                source_priority = 50,
                pdf_url = $4,
                legal_identifier = NULL,
                act_number = NULL,
                gazette_identifier = NULL,
                gazette_id = NULL,
                enacted_date = NULL,
                assent_date = NULL,
                publication_date = NULL,
                effective_date = NULL,
                commencement_date = NULL,
                content_hash = NULL,
                text_fingerprint = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [
          row.id,
          row.prs_detail_url,
          row.prs_source_url,
          row.prs_pdf_url,
        ],
      );
      await client.query(
        `INSERT INTO document_relationships (
           from_document_id,
           to_document_id,
           relationship_type,
           source_name,
           confidence,
           metadata
         )
         VALUES (
           $1, $2, 'became_act', 'india-code', 1,
           '{"repair":"cross-type-title-merge"}'::jsonb
         )
         ON CONFLICT (from_document_id, to_document_id, relationship_type)
         DO NOTHING`,
        [row.id, act.id],
      );
      await client.query("COMMIT");
      repairs.push({
        billDocumentId: row.id,
        actDocumentId: act.id,
        indiaCodeRecordId: row.india_source_record_id,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return repairs;
};

module.exports = {
  completeRun,
  createRun,
  findExistingDocument,
  findCandidates,
  getDuplicateCandidates,
  getPendingReviews,
  getUniversalStats,
  hasMeaningfulDocumentUpdate,
  persistRecord,
  recordIngestionRun,
  eventTypeForRecord,
  updateEventTypeForRecord,
  recordSourceSnapshot,
  repairCrossTypeIndiaCodeMerges,
  storeSnapshots,
  upsertCanonicalDocument,
  upsertDocumentSource,
};
