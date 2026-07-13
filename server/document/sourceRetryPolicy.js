const { query } = require("../db");

const intEnv = (name, fallback, min, max) => {
  const value = Number.parseInt(process.env[name] || fallback, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
};

const DEFAULT_POLICY = Object.freeze({
  concurrency: intEnv("RETRY_DEFAULT_DOMAIN_CONCURRENCY", 2, 1, 8),
  minIntervalMs: intEnv("RETRY_DEFAULT_MIN_INTERVAL_MS", 1_000, 0, 60_000),
  cooldownSeconds: intEnv("RETRY_DEFAULT_COOLDOWN_SECONDS", 900, 60, 86_400),
  windowMinutes: intEnv("RETRY_DEFAULT_WINDOW_MINUTES", 60, 1, 1_440),
  maxAttemptsPerWindow: intEnv("RETRY_DEFAULT_MAX_DOMAIN_ATTEMPTS", 50, 1, 1_000),
  failureRateThreshold: Number(process.env.RETRY_DEFAULT_FAILURE_RATE_THRESHOLD || 0.85),
  minAttemptsBeforeCircuit: intEnv("RETRY_DEFAULT_MIN_ATTEMPTS_BEFORE_CIRCUIT", 10, 1, 1_000),
  maxAttemptsPerDocument: intEnv("RETRY_DEFAULT_MAX_ATTEMPTS_PER_DOCUMENT", 4, 1, 20),
});

const PRS_POLICY = Object.freeze({
  ...DEFAULT_POLICY,
  concurrency: intEnv("RETRY_PRS_DOMAIN_CONCURRENCY", 1, 1, 2),
  minIntervalMs: intEnv("RETRY_PRS_MIN_INTERVAL_MS", 2_500, 500, 120_000),
  cooldownSeconds: intEnv("RETRY_PRS_COOLDOWN_SECONDS", 1_800, 60, 86_400),
  windowMinutes: intEnv("RETRY_PRS_WINDOW_MINUTES", 60, 1, 1_440),
  maxAttemptsPerWindow: intEnv("RETRY_PRS_MAX_DOMAIN_ATTEMPTS", 25, 1, 500),
  failureRateThreshold: Number(process.env.RETRY_PRS_FAILURE_RATE_THRESHOLD || 0.7),
  minAttemptsBeforeCircuit: intEnv("RETRY_PRS_MIN_ATTEMPTS_BEFORE_CIRCUIT", 5, 1, 100),
});

const clampRate = (value) => (
  Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.85
);

const normalizeHost = (host) => String(host || "unknown").trim().toLowerCase();

const getDomainPolicy = (host) => {
  const normalized = normalizeHost(host);
  const policy = /(^|\.)prsindia\.org$/.test(normalized)
    ? PRS_POLICY
    : DEFAULT_POLICY;
  return {
    ...policy,
    failureRateThreshold: clampRate(policy.failureRateThreshold),
  };
};

const statusFromFailure = (failure = {}) => {
  const details = failure.details || {};
  const explicit = Number(details.status || failure.status || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const text = `${failure.failureReason || ""} ${failure.readinessReason || ""}`;
  const match = text.match(/\b(429|500|502|503|504|403|404|410)\b/);
  return match ? Number(match[1]) : null;
};

const retryDelaySeconds = (failure = {}, attempt = 1, policy = DEFAULT_POLICY) => {
  const status = statusFromFailure(failure);
  const retryAfter = Number(failure.details?.retryAfterSeconds || 0);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter, policy.cooldownSeconds);
  }
  const baseByStatus = {
    429: 300,
    500: 60,
    502: 120,
    503: 180,
    504: 240,
  };
  const base = baseByStatus[status] || 90;
  const exp = Math.min(4, Math.max(Number(attempt || 1) - 1, 0));
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.min(
    policy.cooldownSeconds,
    Math.max(30, Math.round(base * 2 ** exp * jitter)),
  );
};

const retryDecisionForFailure = (failure = {}, attempt = 1, maxAttempts = 3) => {
  if (!failure.retryEligible || failure.permanent) return "permanent";
  if (Number(attempt || 1) >= Number(maxAttempts || 3)) {
    return "deferred_retry_exhausted";
  }
  const status = statusFromFailure(failure);
  if (status === 429) return "retry_after_rate_limit";
  if ([500, 502, 503, 504].includes(status)) return `retry_after_http_${status}`;
  return "retry_after_backoff";
};

const recordDomainAttempt = async (sourceHost, metadata = {}) => {
  const host = normalizeHost(sourceHost);
  const policy = getDomainPolicy(host);
  await query(
    `INSERT INTO document_retry_domain_state (
       source_host, policy_json, window_started_at, window_attempts,
       total_attempts, last_request_at, metadata_json
     )
     VALUES ($1, $2::jsonb, NOW(), 1, 1, NOW(), $3::jsonb)
     ON CONFLICT (source_host) DO UPDATE SET
       policy_json = EXCLUDED.policy_json,
       window_started_at = CASE
         WHEN document_retry_domain_state.window_started_at <
           NOW() - (($4)::TEXT || ' minutes')::INTERVAL
           THEN NOW()
         ELSE document_retry_domain_state.window_started_at
       END,
       window_attempts = CASE
         WHEN document_retry_domain_state.window_started_at <
           NOW() - (($4)::TEXT || ' minutes')::INTERVAL
           THEN 1
         ELSE document_retry_domain_state.window_attempts + 1
       END,
       window_failures = CASE
         WHEN document_retry_domain_state.window_started_at <
           NOW() - (($4)::TEXT || ' minutes')::INTERVAL
           THEN 0
         ELSE document_retry_domain_state.window_failures
       END,
       total_attempts = document_retry_domain_state.total_attempts + 1,
       last_request_at = NOW(),
       metadata_json = document_retry_domain_state.metadata_json || EXCLUDED.metadata_json,
       updated_at = NOW()`,
    [
      host,
      JSON.stringify(policy),
      JSON.stringify(metadata),
      policy.windowMinutes,
    ],
  );
};

const recordDomainResult = async (
  sourceHost,
  {
    success,
    failure = null,
    metadata = {},
  } = {},
) => {
  const host = normalizeHost(sourceHost);
  const policy = getDomainPolicy(host);
  const status = statusFromFailure(failure || {});
  const failureCode = failure?.failureCode || null;
  const reason = failure?.failureReason || failure?.readinessReason || null;
  await query(
    `INSERT INTO document_retry_domain_state (
       source_host, policy_json, circuit_state, window_started_at,
       window_attempts, window_failures, consecutive_failures,
       total_attempts, total_successes, total_failures,
       last_request_at, last_success_at, last_failure_at,
       last_status_code, last_failure_code, last_failure_reason,
       metadata_json
     )
     VALUES (
       $1, $2::jsonb, 'closed', NOW(),
       0, CASE WHEN $3::BOOLEAN THEN 0 ELSE 1 END,
       CASE WHEN $3::BOOLEAN THEN 0 ELSE 1 END,
       0, CASE WHEN $3::BOOLEAN THEN 1 ELSE 0 END,
       CASE WHEN $3::BOOLEAN THEN 0 ELSE 1 END,
       NOW(), CASE WHEN $3::BOOLEAN THEN NOW() END,
       CASE WHEN NOT $3::BOOLEAN THEN NOW() END,
       $4, $5, $6, $7::jsonb
     )
     ON CONFLICT (source_host) DO UPDATE SET
       policy_json = EXCLUDED.policy_json,
       window_started_at = CASE
         WHEN document_retry_domain_state.window_started_at <
           NOW() - (($8)::TEXT || ' minutes')::INTERVAL
           THEN NOW()
         ELSE document_retry_domain_state.window_started_at
       END,
       window_failures = CASE
         WHEN $3::BOOLEAN THEN
           CASE
             WHEN document_retry_domain_state.window_started_at <
               NOW() - (($8)::TEXT || ' minutes')::INTERVAL
               THEN 0
             ELSE document_retry_domain_state.window_failures
           END
         ELSE
           CASE
             WHEN document_retry_domain_state.window_started_at <
               NOW() - (($8)::TEXT || ' minutes')::INTERVAL
               THEN 1
             ELSE document_retry_domain_state.window_failures + 1
           END
       END,
       consecutive_failures = CASE
         WHEN $3::BOOLEAN THEN 0
         ELSE document_retry_domain_state.consecutive_failures + 1
       END,
       total_successes = document_retry_domain_state.total_successes +
         CASE WHEN $3::BOOLEAN THEN 1 ELSE 0 END,
       total_failures = document_retry_domain_state.total_failures +
         CASE WHEN $3::BOOLEAN THEN 0 ELSE 1 END,
       last_success_at = CASE
         WHEN $3::BOOLEAN THEN NOW()
         ELSE document_retry_domain_state.last_success_at
       END,
       last_failure_at = CASE
         WHEN $3::BOOLEAN THEN document_retry_domain_state.last_failure_at
         ELSE NOW()
       END,
       last_status_code = COALESCE($4, document_retry_domain_state.last_status_code),
       last_failure_code = COALESCE($5, document_retry_domain_state.last_failure_code),
       last_failure_reason = COALESCE($6, document_retry_domain_state.last_failure_reason),
       circuit_state = CASE
         WHEN $3::BOOLEAN THEN 'closed'
         WHEN (
           CASE
             WHEN document_retry_domain_state.window_started_at <
               NOW() - (($8)::TEXT || ' minutes')::INTERVAL
               THEN 1
             ELSE document_retry_domain_state.window_failures + 1
           END
         ) >= $9
         AND (
           (
             CASE
               WHEN document_retry_domain_state.window_started_at <
                 NOW() - (($8)::TEXT || ' minutes')::INTERVAL
                 THEN 1
               ELSE document_retry_domain_state.window_failures + 1
             END
           )::NUMERIC / GREATEST(
             CASE
               WHEN document_retry_domain_state.window_started_at <
                 NOW() - (($8)::TEXT || ' minutes')::INTERVAL
                 THEN 1
               ELSE document_retry_domain_state.window_attempts
             END,
             1
           )
         ) >= $10::NUMERIC THEN 'cooldown'
         ELSE document_retry_domain_state.circuit_state
       END,
       cooldown_until = CASE
         WHEN $3::BOOLEAN THEN NULL
         WHEN (
           CASE
             WHEN document_retry_domain_state.window_started_at <
               NOW() - (($8)::TEXT || ' minutes')::INTERVAL
               THEN 1
             ELSE document_retry_domain_state.window_failures + 1
           END
         ) >= $9
         AND (
           (
             CASE
               WHEN document_retry_domain_state.window_started_at <
                 NOW() - (($8)::TEXT || ' minutes')::INTERVAL
                 THEN 1
               ELSE document_retry_domain_state.window_failures + 1
             END
           )::NUMERIC / GREATEST(
             CASE
               WHEN document_retry_domain_state.window_started_at <
                 NOW() - (($8)::TEXT || ' minutes')::INTERVAL
                 THEN 1
               ELSE document_retry_domain_state.window_attempts
             END,
             1
           )
         ) >= $10::NUMERIC
           THEN NOW() + (($11)::TEXT || ' seconds')::INTERVAL
         ELSE document_retry_domain_state.cooldown_until
       END,
       circuit_activations = document_retry_domain_state.circuit_activations +
         CASE
           WHEN NOT $3::BOOLEAN
            AND document_retry_domain_state.circuit_state = 'closed'
            AND (document_retry_domain_state.window_failures + 1) >= $9
            THEN 1
           ELSE 0
         END,
       metadata_json = document_retry_domain_state.metadata_json || EXCLUDED.metadata_json,
       updated_at = NOW()`,
    [
      host,
      JSON.stringify(policy),
      Boolean(success),
      status,
      failureCode,
      reason ? String(reason).slice(0, 500) : null,
      JSON.stringify(metadata),
      policy.windowMinutes,
      policy.minAttemptsBeforeCircuit,
      policy.failureRateThreshold,
      policy.cooldownSeconds,
    ],
  );
};

module.exports = {
  DEFAULT_POLICY,
  PRS_POLICY,
  getDomainPolicy,
  normalizeHost,
  recordDomainAttempt,
  recordDomainResult,
  retryDecisionForFailure,
  retryDelaySeconds,
  statusFromFailure,
};
