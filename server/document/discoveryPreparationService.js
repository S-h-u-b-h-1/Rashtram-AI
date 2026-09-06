const { getPool } = require("../db");
const { assertBulkProcessingSafe } = require("../lib/database/capacity");
const { getProblemRecommendations, RELEVANCE_TIERS } = require("./recommendationService");
const { getDocumentReadiness } = require("./readinessContract");

const automaticCandidates = (items = []) => items.filter((item) =>
  !item.researchReady && ["PRIMARY_OFFICIAL", "PRIMARY_LEGAL_TEXT"].includes(item.authorityClass) &&
  [RELEVANCE_TIERS.HIGH, RELEVANCE_TIERS.MEDIUM].includes(item.relevanceTier),
).slice(0, 3);

// Serialise against the document row, not process memory: repeat requests cannot
// reset an exhausted job's attempt budget, even across serverless instances.
const enqueueDiscoveryCandidate = async (documentId, userId) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM documents WHERE id = $1 FOR UPDATE", [documentId]);
    const previous = await client.query(
      "SELECT * FROM document_processing_jobs WHERE document_id = $1 ORDER BY id DESC", [documentId],
    );
    const active = previous.rows.find((job) => ["queued", "running"].includes(job.status));
    if (active) {
      await client.query("COMMIT");
      return { documentId, status: active.status, jobId: active.id, nextAttemptAt: active.next_attempt_at };
    }
    if (previous.rows.some((job) => ["dead_letter", "failed"].includes(job.status)) ||
        previous.rows.reduce((sum, job) => sum + Number(job.attempt || 0), 0) >= 2) {
      await client.query("COMMIT");
      return { documentId, status: "unavailable", reason: "Automatic retry limit reached. Open the document to review the failure before retrying." };
    }
    const inserted = await client.query(
      `INSERT INTO document_processing_jobs (document_id, requested_by, priority, metadata_json, source_host, max_attempts)
       SELECT $1, $2, 95, '{"reason":"just_in_time_discovery"}'::jsonb,
         NULLIF(LOWER(SUBSTRING(COALESCE(pdf_url, canonical_url, source_url) FROM '^[a-z]+://([^/:]+)')), ''), 2
       FROM legislative_documents WHERE id = $1
       ON CONFLICT (document_id) WHERE status IN ('queued', 'running') DO NOTHING
       RETURNING id`, [documentId, userId],
    );
    await client.query("COMMIT");
    return { documentId, status: "queued", jobId: inserted.rows[0]?.id || null };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
};

const prepareDiscoveryCandidates = async (userId, payload = {}) => {
  const supplied = Array.isArray(payload.documentIds) ? payload.documentIds : [];
  if (supplied.length > 5) throw Object.assign(new Error("At most five candidates may be requested."), { status: 400 });
  const requested = new Set(supplied.map(String));
  // Re-evaluate relevance on the server; a client cannot auto-prepare arbitrary
  // catalogue records by submitting forged scores, authority, or readiness.
  const discovery = await getProblemRecommendations(null, { problem: payload.problem, limit: 20 });
  const eligible = automaticCandidates(discovery.discoveryCandidates).filter((item) => requested.has(String(item.id)));
  const pool = getPool();
  let capacityChecked = false;
  const candidates = [];
  for (const documentId of requested) {
    if (!/^\d+$/.test(documentId) || Number(documentId) <= 0) continue;
    const readiness = await getDocumentReadiness(documentId);
    if (readiness?.researchReady) {
      candidates.push({ documentId, status: "ready" });
    } else if (!eligible.some((item) => String(item.id) === documentId)) {
      candidates.push({ documentId, status: "unavailable", reason: "Not among the three most relevant official sources eligible for automatic preparation." });
    } else if (["processing", "queued"].includes(readiness?.status)) {
      candidates.push(await enqueueDiscoveryCandidate(documentId, userId));
    } else if (!readiness?.canPrepare) {
      candidates.push({ documentId, status: "unavailable", reason: readiness?.reason || "No recoverable source is available." });
    } else {
      if (!capacityChecked) { await assertBulkProcessingSafe(pool); capacityChecked = true; }
      candidates.push(await enqueueDiscoveryCandidate(documentId, userId));
    }
  }
  return { candidates, queued: candidates.filter((item) => item.status === "queued").length };
};

module.exports = { automaticCandidates, enqueueDiscoveryCandidate, prepareDiscoveryCandidates };
