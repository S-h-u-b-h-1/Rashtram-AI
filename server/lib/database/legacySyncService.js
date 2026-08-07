// Provider-neutral legacy -> schema-v2 synchronisation.
//
// Replaces the PL/pgSQL trigger `sync_document_v2_from_legacy()` (and
// siblings) with explicit application-level calls. CockroachDB cannot run
// those triggers at all: `CREATE TRIGGER` fails to resolve `NEW`
// (42P01) and `%ROWTYPE` is unimplemented (0A000). See
// docs/COCKROACHDB_MIGRATION_AND_CUTOVER.md.
//
// The port is not a rewrite of the logic — it is the same logic expressed
// as portable SQL:
//
//   * `DECLARE registry_id ... SELECT INTO`      -> LEFT JOIN source_registry
//   * `DECLARE r document_text_artifacts%ROWTYPE`-> LEFT JOIN document_text_artifacts
//   * `NEW.<col>`                                -> `legacy.<col>`
//
// Everything else — the derived subtype, the readiness predicate, the
// quality score, the ON CONFLICT update list — is character-for-character
// the trigger's own expression set, so PostgreSQL behaviour is preserved
// exactly when the trigger is eventually dropped.
//
// Properties required of this service, and how each is achieved:
//   transactional  - the caller supplies the client; this never opens or
//                    commits a transaction of its own.
//   idempotent     - ON CONFLICT (id) DO UPDATE; running N times equals
//                    running once.
//   rollback safe  - no writes outside the caller's transaction, no
//                    in-memory state, no external side effects.
//   retry safe     - a direct consequence of idempotency; safe to replay
//                    under a serializable retry (see transactionRetry.js).
//   no hidden writes - callers invoke it explicitly; nothing fires
//                    implicitly on INSERT/UPDATE.

// Reads the legacy row as the single source of truth rather than taking
// caller-supplied field values. That means a caller cannot desynchronise
// v2 by passing stale or partial data — the same guarantee the AFTER
// trigger gave, since it also read committed row state.
const SYNC_DOCUMENT_SQL = `
INSERT INTO documents (
  id, canonical_id, title, normalized_title, document_type, document_subtype,
  jurisdiction_level, jurisdiction, state, country, authority, ministry,
  department, category, status, language, script, is_bilingual, year,
  publication_date, introduced_date, passed_date, assent_date,
  commencement_date, effective_date, legal_identifier, bill_number,
  act_number, gazette_identifier, source_priority, canonical_source_id,
  canonical_url, research_ready, visibility_status, quality_score,
  metadata_json, created_at, updated_at, first_seen_at, last_seen_at
)
SELECT
  legacy.id,
  legacy.canonical_id,
  legacy.title,
  COALESCE(NULLIF(legacy.normalized_title, ''), LOWER(legacy.title)),
  LOWER(REPLACE(legacy.document_type, '-', '_')),
  CASE
    WHEN legacy.jurisdiction_level = 'state' AND legacy.document_type = 'bill' THEN 'state_bill'
    WHEN legacy.jurisdiction_level = 'state' AND legacy.document_type = 'act' THEN 'state_act'
  END,
  legacy.jurisdiction_level,
  legacy.jurisdiction,
  COALESCE(legacy.metadata_json ->> 'state', CASE WHEN legacy.jurisdiction_level = 'state' THEN legacy.jurisdiction END),
  COALESCE(legacy.metadata_json ->> 'country', 'India'),
  legacy.authority, legacy.ministry, legacy.department, legacy.category, legacy.status,
  COALESCE(artifact.language_code, legacy.metadata_json ->> 'languageCode', legacy.metadata_json ->> 'language', 'und'),
  COALESCE(artifact.script, legacy.metadata_json ->> 'script', 'Unknown'),
  COALESCE(artifact.is_bilingual, FALSE),
  legacy.year, legacy.publication_date, legacy.introduced_date, legacy.passed_date,
  COALESCE(legacy.assent_date, legacy.enacted_date),
  COALESCE(legacy.commencement_date, legacy.effective_date), legacy.effective_date,
  legacy.legal_identifier, legacy.bill_number, legacy.act_number,
  legacy.gazette_identifier, legacy.source_priority, registry.id,
  COALESCE(legacy.canonical_url, legacy.detail_url, legacy.source_url),
  COALESCE(
    legacy.processing_status = 'ready'
    AND artifact.document_id IS NOT NULL
    AND legacy.pdf_url IS NOT NULL,
    FALSE
  ),
  CASE WHEN COALESCE(legacy.canonical_url, legacy.source_url) IS NULL THEN 'internal_only' ELSE 'public' END,
  LEAST(
    100,
    (CASE WHEN NULLIF(TRIM(legacy.title), '') IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN COALESCE(legacy.canonical_url, legacy.source_url) IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN legacy.pdf_url IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN legacy.publication_date IS NOT NULL OR legacy.year IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN legacy.ministry IS NOT NULL OR legacy.authority IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN legacy.jurisdiction IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN legacy.processing_status = 'ready' THEN 15 ELSE 0 END) +
    (CASE WHEN artifact.document_id IS NOT NULL THEN 10 ELSE 0 END)
  ),
  legacy.metadata_json || legacy.source_metadata,
  legacy.created_at, legacy.updated_at, legacy.first_seen_at, legacy.last_seen_at
FROM legislative_documents legacy
LEFT JOIN document_text_artifacts artifact ON artifact.document_id = legacy.id
LEFT JOIN source_registry registry
  ON registry.source_name = COALESCE(legacy.canonical_source, legacy.source_name)
WHERE legacy.id = $1
ON CONFLICT (id) DO UPDATE SET
  canonical_id = EXCLUDED.canonical_id,
  title = EXCLUDED.title,
  normalized_title = EXCLUDED.normalized_title,
  document_type = EXCLUDED.document_type,
  document_subtype = EXCLUDED.document_subtype,
  jurisdiction_level = EXCLUDED.jurisdiction_level,
  jurisdiction = EXCLUDED.jurisdiction,
  state = EXCLUDED.state,
  country = EXCLUDED.country,
  authority = EXCLUDED.authority,
  ministry = EXCLUDED.ministry,
  department = EXCLUDED.department,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  language = EXCLUDED.language,
  script = EXCLUDED.script,
  is_bilingual = EXCLUDED.is_bilingual,
  year = EXCLUDED.year,
  publication_date = EXCLUDED.publication_date,
  introduced_date = EXCLUDED.introduced_date,
  passed_date = EXCLUDED.passed_date,
  assent_date = EXCLUDED.assent_date,
  commencement_date = EXCLUDED.commencement_date,
  effective_date = EXCLUDED.effective_date,
  legal_identifier = EXCLUDED.legal_identifier,
  bill_number = EXCLUDED.bill_number,
  act_number = EXCLUDED.act_number,
  gazette_identifier = EXCLUDED.gazette_identifier,
  source_priority = EXCLUDED.source_priority,
  canonical_source_id = EXCLUDED.canonical_source_id,
  canonical_url = EXCLUDED.canonical_url,
  research_ready = EXCLUDED.research_ready,
  visibility_status = EXCLUDED.visibility_status,
  quality_score = EXCLUDED.quality_score,
  metadata_json = EXCLUDED.metadata_json,
  updated_at = EXCLUDED.updated_at,
  last_seen_at = EXCLUDED.last_seen_at`;

// Faithful port of sync_resource_v2_from_legacy(). Note this one carries
// two correlated subqueries (source_id, is_primary) and three regex
// operations that the document sync does not — those are the parts most
// at risk of behavioural divergence between engines and are covered by
// the parity test.
const SYNC_RESOURCE_SQL = `
INSERT INTO document_resources (
  id, document_id, source_id, resource_type, label, url, mime_type,
  file_extension, file_size, language, hash_sha256, is_primary,
  is_accessible, metadata_json, created_at, updated_at
)
SELECT
  legacy.id, legacy.document_id,
  (
    SELECT id FROM document_sources
    WHERE document_id = legacy.document_id
    ORDER BY source_priority, id LIMIT 1
  ),
  CASE WHEN legacy.url ~* '\\.pdf(?:$|[?#])' THEN 'pdf' ELSE COALESCE(legacy.resource_type, 'link') END,
  legacy.label, legacy.url,
  COALESCE(legacy.metadata ->> 'mimeType', CASE WHEN legacy.url ~* '\\.pdf(?:$|[?#])' THEN 'application/pdf' END),
  LOWER(NULLIF(SUBSTRING(legacy.url FROM '\\.([a-zA-Z0-9]+)(?:[?#].*)?$'), '')),
  NULLIF(legacy.metadata ->> 'fileSizeBytes', '')::BIGINT,
  legacy.metadata ->> 'language',
  COALESCE(legacy.metadata ->> 'hashSha256', legacy.metadata ->> 'fileHash'),
  EXISTS (
    SELECT 1 FROM legislative_documents
    WHERE id = legacy.document_id AND pdf_url = legacy.url
  ),
  TRUE, legacy.metadata, legacy.created_at, legacy.updated_at
FROM legislative_document_resources legacy
WHERE legacy.id = $1
ON CONFLICT (id) DO UPDATE SET
  source_id = EXCLUDED.source_id,
  resource_type = EXCLUDED.resource_type,
  label = EXCLUDED.label,
  url = EXCLUDED.url,
  mime_type = EXCLUDED.mime_type,
  file_extension = EXCLUDED.file_extension,
  file_size = EXCLUDED.file_size,
  language = EXCLUDED.language,
  hash_sha256 = EXCLUDED.hash_sha256,
  is_primary = EXCLUDED.is_primary,
  metadata_json = EXCLUDED.metadata_json,
  updated_at = EXCLUDED.updated_at`;

/**
 * Mirror one legacy document row into the v2 `documents` table.
 * Must be called inside the caller's transaction, immediately after the
 * legacy write, so the two commit atomically.
 *
 * Returns the number of v2 rows written (0 means the legacy row did not
 * exist — a no-op, not an error, so a delete/sync race cannot throw).
 */
const syncDocumentToV2 = async (client, documentId) => {
  const result = await client.query(SYNC_DOCUMENT_SQL, [documentId]);
  return result.rowCount;
};

const syncResourceToV2 = async (client, resourceId) => {
  const result = await client.query(SYNC_RESOURCE_SQL, [resourceId]);
  return result.rowCount;
};

/**
 * Convenience wrapper: write via `mutate`, then mirror to v2, both inside
 * the SAME transaction the caller already opened. Keeping the transaction
 * boundary with the caller is deliberate — it lets a caller batch several
 * legacy writes and their mirrors into one atomic unit, and it means a
 * rollback discards legacy and v2 together rather than leaving them
 * divergent.
 */
const withDocumentSync = async (client, documentId, mutate) => {
  const result = await mutate(client);
  await syncDocumentToV2(client, documentId);
  return result;
};

module.exports = {
  SYNC_DOCUMENT_SQL,
  SYNC_RESOURCE_SQL,
  syncDocumentToV2,
  syncResourceToV2,
  withDocumentSync,
};
