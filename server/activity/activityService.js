const { query } = require("../db");

const ALLOWED_ACTIVITY_EVENTS = new Set([
  "login",
  "logout",
  "dashboard_viewed",
  "document_opened",
  "bill_opened",
  "act_opened",
  "search_performed",
  "filter_used",
  "chat_started",
  "chat_message_sent",
  "summary_viewed",
  "source_opened",
  "profile_viewed",
  "research_continued",
  "export_clicked",
  "comparison_created",
  "documents_compared",
  "recommendation_viewed",
  "recommendation_opened",
  "recommendation_added_to_compare",
  "business_problem_searched",
  "graph_viewed",
  "graph_node_opened",
  "graph_path_searched",
  "graph_path_saved",
]);

const DOCUMENT_INTERACTION_EVENTS = new Set([
  "document_opened",
  "bill_opened",
  "act_opened",
  "summary_viewed",
  "source_opened",
  "research_continued",
  "recommendation_viewed",
  "recommendation_opened",
  "recommendation_added_to_compare",
  "graph_viewed",
  "graph_node_opened",
]);

const SENSITIVE_KEY_PATTERN =
  /(password|passcode|token|secret|authorization|cookie|credential|api.?key)/i;

const sanitizeText = (value, maximumLength) => {
  if (value == null) return null;
  const text = String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, maximumLength) : null;
};

const sanitizePath = (value) => {
  const text = sanitizeText(value, 500);
  return text ? text.split(/[?#]/, 1)[0] : null;
};

const sanitizeReferrer = (value) => {
  const text = sanitizeText(value, 500);
  if (!text) return null;
  try {
    const url = new URL(text);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
};

const sanitizeJsonValue = (value, depth = 0) => {
  if (depth > 4 || value == null) return null;
  if (typeof value === "string") return sanitizeText(value, 500);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item) => item != null);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
        .slice(0, 40)
        .map(([key, item]) => [
          sanitizeText(key, 80),
          sanitizeJsonValue(item, depth + 1),
        ])
        .filter(([key, item]) => key && item != null),
    );
  }
  return null;
};

const sanitizeJsonObject = (value, fieldName) => {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be a JSON object.`);
  }
  const sanitized = sanitizeJsonValue(value) || {};
  if (Buffer.byteLength(JSON.stringify(sanitized), "utf8") > 8_192) {
    throw new Error(`${fieldName} is too large.`);
  }
  return sanitized;
};

const normalizeDocumentId = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("document_id must be a positive integer.");
  }
  return parsed;
};

const validateActivityPayload = (payload = {}) => {
  const eventType = sanitizeText(payload.event_type, 64);
  if (!ALLOWED_ACTIVITY_EVENTS.has(eventType)) {
    throw new Error("Unsupported activity event type.");
  }

  return {
    eventType,
    entityType: sanitizeText(payload.entity_type, 64),
    entityId: sanitizeText(payload.entity_id, 160),
    documentId: normalizeDocumentId(payload.document_id),
    sessionId: sanitizeText(payload.session_id, 160),
    pagePath: sanitizePath(payload.page_path),
    searchQuery: sanitizeText(payload.search_query, 300),
    filters: sanitizeJsonObject(payload.filters_json, "filters_json"),
    metadata: sanitizeJsonObject(payload.metadata_json, "metadata_json"),
  };
};

const appendPreference = (values, value) => {
  if (!value) return Array.isArray(values) ? values : [];
  return [...new Set([...(Array.isArray(values) ? values : []), value])].slice(
    -25,
  );
};

const ensurePreferences = async (userId, execute = query) => {
  await execute(
    `INSERT INTO user_research_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
};

const getActivityPreferences = async (userId, execute = query) => {
  await ensurePreferences(userId, execute);
  const result = await execute(
    `SELECT
       activity_tracking_enabled,
       personalization_enabled,
       consented_at,
       revoked_at,
       last_active_at,
       updated_at
     FROM user_research_preferences
     WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    activityTrackingEnabled: row.activity_tracking_enabled,
    personalizationEnabled: row.personalization_enabled,
    consentedAt: row.consented_at,
    revokedAt: row.revoked_at,
    lastActiveAt: row.last_active_at,
    updatedAt: row.updated_at,
  };
};

const updateActivityPreferences = async (
  userId,
  { activityTrackingEnabled, personalizationEnabled },
  execute = query,
) => {
  if (
    typeof activityTrackingEnabled !== "boolean" ||
    typeof personalizationEnabled !== "boolean"
  ) {
    throw new Error("Both privacy preference values must be boolean.");
  }
  if (personalizationEnabled && !activityTrackingEnabled) {
    throw new Error(
      "Personalization requires research activity history to be enabled.",
    );
  }

  const result = await execute(
    `INSERT INTO user_research_preferences (
       user_id,
       activity_tracking_enabled,
       personalization_enabled,
       consented_at,
       revoked_at
     )
     VALUES (
       $1, $2, $3,
       CASE WHEN $2 THEN NOW() ELSE NULL END,
       CASE WHEN $2 THEN NULL ELSE NOW() END
     )
     ON CONFLICT (user_id)
     DO UPDATE SET
       activity_tracking_enabled = EXCLUDED.activity_tracking_enabled,
       personalization_enabled = EXCLUDED.personalization_enabled,
       consented_at = CASE
         WHEN EXCLUDED.activity_tracking_enabled
           AND user_research_preferences.consented_at IS NULL
         THEN NOW()
         ELSE user_research_preferences.consented_at
       END,
       revoked_at = CASE
         WHEN EXCLUDED.activity_tracking_enabled THEN NULL
         ELSE NOW()
       END,
       updated_at = NOW()
     RETURNING
       activity_tracking_enabled,
       personalization_enabled,
       consented_at,
       revoked_at,
       last_active_at,
       updated_at`,
    [userId, activityTrackingEnabled, personalizationEnabled],
  );
  const row = result.rows[0];
  return {
    activityTrackingEnabled: row.activity_tracking_enabled,
    personalizationEnabled: row.personalization_enabled,
    consentedAt: row.consented_at,
    revokedAt: row.revoked_at,
    lastActiveAt: row.last_active_at,
    updatedAt: row.updated_at,
  };
};

const updatePreferenceSignals = async (
  userId,
  activity,
  execute = query,
) => {
  const result = await execute(
    `SELECT
       preferred_topics_json,
       preferred_jurisdictions_json,
       preferred_document_types_json,
       frequently_viewed_ministries_json
     FROM user_research_preferences
     WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0] || {};
  const topic =
    sanitizeText(activity.metadata.topic, 120) ||
    sanitizeText(activity.metadata.category, 120);
  const jurisdiction = sanitizeText(activity.metadata.jurisdiction, 120);
  const documentType =
    sanitizeText(activity.metadata.documentType, 80) || activity.entityType;
  const ministry = sanitizeText(activity.metadata.ministry, 160);

  await execute(
    `UPDATE user_research_preferences
        SET preferred_topics_json = $2::jsonb,
            preferred_jurisdictions_json = $3::jsonb,
            preferred_document_types_json = $4::jsonb,
            frequently_viewed_ministries_json = $5::jsonb,
            last_active_at = NOW(),
            updated_at = NOW()
      WHERE user_id = $1`,
    [
      userId,
      JSON.stringify(appendPreference(row.preferred_topics_json, topic)),
      JSON.stringify(
        appendPreference(row.preferred_jurisdictions_json, jurisdiction),
      ),
      JSON.stringify(
        appendPreference(row.preferred_document_types_json, documentType),
      ),
      JSON.stringify(
        appendPreference(row.frequently_viewed_ministries_json, ministry),
      ),
    ],
  );
};

const recordActivity = async (
  userId,
  payload,
  context = {},
  execute = query,
) => {
  const activity = validateActivityPayload(payload);
  const preferences = await getActivityPreferences(userId, execute);
  if (!preferences.activityTrackingEnabled) {
    return { tracked: false, reason: "consent_required" };
  }

  const referrer = sanitizeReferrer(context.referrer);
  const result = await execute(
    `INSERT INTO user_activity_events (
       user_id,
       event_type,
       entity_type,
       entity_id,
       document_id,
       session_id,
       page_path,
       referrer,
       search_query,
       filters_json,
       metadata_json
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb
     )
     RETURNING id, created_at`,
    [
      userId,
      activity.eventType,
      activity.entityType,
      activity.entityId,
      activity.documentId,
      activity.sessionId,
      activity.pagePath,
      referrer,
      activity.searchQuery,
      JSON.stringify(activity.filters),
      JSON.stringify(activity.metadata),
    ],
  );

  if (
    activity.documentId &&
    DOCUMENT_INTERACTION_EVENTS.has(activity.eventType)
  ) {
    await execute(
      `INSERT INTO user_document_interactions (
         user_id,
         document_id,
         interaction_type,
         metadata_json
       )
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (user_id, document_id, interaction_type)
       DO UPDATE SET
         count = user_document_interactions.count + 1,
         last_interacted_at = NOW(),
         metadata_json =
           user_document_interactions.metadata_json || EXCLUDED.metadata_json`,
      [
        userId,
        activity.documentId,
        activity.eventType,
        JSON.stringify(activity.metadata),
      ],
    );
  }

  await updatePreferenceSignals(userId, activity, execute);
  return {
    tracked: true,
    eventId: String(result.rows[0].id),
    createdAt: result.rows[0].created_at,
  };
};

const getActivityInsights = async (userId) => {
  const [preferences, recentDocuments, topics, jurisdictions, types, searches] =
    await Promise.all([
      getActivityPreferences(userId),
      query(
        `SELECT
           i.document_id,
           d.title,
           d.document_type,
           d.jurisdiction,
           d.pdf_url,
           SUM(i.count)::INTEGER AS interactions,
           MAX(i.last_interacted_at) AS last_interacted_at
         FROM user_document_interactions i
         JOIN legislative_documents d ON d.id = i.document_id
         WHERE i.user_id = $1
         GROUP BY
           i.document_id,
           d.title,
           d.document_type,
           d.jurisdiction,
           d.pdf_url
         ORDER BY last_interacted_at DESC
         LIMIT 6`,
        [userId],
      ),
      query(
        `SELECT
           COALESCE(
             NULLIF(metadata_json->>'topic', ''),
             NULLIF(metadata_json->>'category', '')
           ) AS label,
           COUNT(*)::INTEGER AS interactions
         FROM user_activity_events
         WHERE user_id = $1
         GROUP BY label
         HAVING COALESCE(
           NULLIF(metadata_json->>'topic', ''),
           NULLIF(metadata_json->>'category', '')
         ) IS NOT NULL
         ORDER BY interactions DESC, label
         LIMIT 8`,
        [userId],
      ),
      query(
        `SELECT
           metadata_json->>'jurisdiction' AS label,
           COUNT(*)::INTEGER AS interactions
         FROM user_activity_events
         WHERE user_id = $1
           AND NULLIF(metadata_json->>'jurisdiction', '') IS NOT NULL
         GROUP BY label
         ORDER BY interactions DESC, label
         LIMIT 8`,
        [userId],
      ),
      query(
        `SELECT
           COALESCE(
             NULLIF(metadata_json->>'documentType', ''),
             NULLIF(entity_type, '')
           ) AS label,
           COUNT(*)::INTEGER AS interactions
         FROM user_activity_events
         WHERE user_id = $1
         GROUP BY label
         HAVING COALESCE(
           NULLIF(metadata_json->>'documentType', ''),
           NULLIF(entity_type, '')
         ) IS NOT NULL
         ORDER BY interactions DESC, label
         LIMIT 8`,
        [userId],
      ),
      query(
        `SELECT search_query, created_at
         FROM (
           SELECT DISTINCT ON (search_query)
             search_query,
             created_at
           FROM user_activity_events
           WHERE user_id = $1
             AND event_type = 'search_performed'
             AND search_query IS NOT NULL
           ORDER BY search_query, created_at DESC
         ) latest_searches
         ORDER BY created_at DESC
         LIMIT 8`,
        [userId],
      ),
    ]);

  return {
    ...preferences,
    recentDocuments: recentDocuments.rows.map((row) => ({
      documentId: String(row.document_id),
      title: row.title,
      documentType: row.document_type,
      jurisdiction: row.jurisdiction,
      pdfUrl: row.pdf_url,
      interactions: row.interactions,
      lastInteractedAt: row.last_interacted_at,
    })),
    topTopics: topics.rows,
    topJurisdictions: jurisdictions.rows,
    mostViewedDocumentTypes: types.rows,
    recentSearches: searches.rows.map((row) => ({
      query: row.search_query,
      searchedAt: row.created_at,
    })),
  };
};

module.exports = {
  ALLOWED_ACTIVITY_EVENTS,
  DOCUMENT_INTERACTION_EVENTS,
  getActivityInsights,
  getActivityPreferences,
  recordActivity,
  sanitizeJsonObject,
  sanitizeJsonValue,
  sanitizePath,
  sanitizeReferrer,
  sanitizeText,
  updateActivityPreferences,
  validateActivityPayload,
};
