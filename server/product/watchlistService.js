const { query } = require("../db");

const WATCH_TYPES = new Set([
  "regulator", "ministry", "industry", "document", "jurisdiction", "state", "topic",
]);

const normalizeValue = (value) => String(value || "")
  .normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 240);

const validateWatchlist = (payload = {}) => {
  const watchType = normalizeValue(payload.watchType).toLowerCase();
  const watchValue = normalizeValue(payload.watchValue);
  if (!WATCH_TYPES.has(watchType)) {
    const error = new Error("Choose a supported watchlist type.");
    error.status = 400;
    throw error;
  }
  if (watchValue.length < 2) {
    const error = new Error("Enter at least two characters to create a watchlist.");
    error.status = 400;
    throw error;
  }
  return { watchType, watchValue, normalizedValue: watchValue.toLowerCase() };
};

const mapWatchlist = (row) => ({
  id: String(row.id), watchType: row.watch_type, watchValue: row.watch_value,
  active: row.active, lastCheckedAt: row.last_checked_at, createdAt: row.created_at,
});

const mapAlert = (row) => ({
  id: String(row.id), watchlistId: String(row.watchlist_id),
  intelligenceEventId: String(row.intelligence_event_id), title: row.title,
  whyTriggered: row.why_triggered, impactSummary: row.impact_summary,
  sourceName: row.source_name, sourceUrl: row.source_url, eventDate: row.event_date,
  evidence: row.evidence_json || {}, readAt: row.read_at, createdAt: row.created_at,
});

const createWatchlist = async (userId, payload, adapter = query) => {
  const input = validateWatchlist(payload);
  const result = await adapter(
    `INSERT INTO research_watchlists
       (user_id, watch_type, watch_value, normalized_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, watch_type, normalized_value)
     DO UPDATE SET active = TRUE, watch_value = EXCLUDED.watch_value, updated_at = NOW()
     RETURNING *`,
    [userId, input.watchType, input.watchValue, input.normalizedValue],
  );
  return mapWatchlist(result.rows[0]);
};

const listWatchlists = async (userId, adapter = query) => {
  const result = await adapter(
    `SELECT * FROM research_watchlists WHERE user_id = $1 AND active = TRUE
     ORDER BY updated_at DESC`, [userId],
  );
  return result.rows.map(mapWatchlist);
};

const deleteWatchlist = async (userId, watchlistId, adapter = query) => {
  const result = await adapter(
    `DELETE FROM research_watchlists WHERE id = $1 AND user_id = $2 RETURNING id`,
    [watchlistId, userId],
  );
  if (!result.rowCount) {
    const error = new Error("Watchlist not found.");
    error.status = 404;
    throw error;
  }
  return { deleted: true, id: String(result.rows[0].id) };
};

const eventMatches = (watchlist, event) => {
  const watchType = watchlist.watch_type || watchlist.watchType;
  const watchValue = watchlist.watch_value || watchlist.watchValue;
  const needle = watchlist.normalized_value || normalizeValue(watchValue).toLowerCase();
  const exactFields = watchType === "regulator"
    ? [event.authority]
    : watchType === "ministry"
      ? [event.ministry]
      : ["jurisdiction", "state"].includes(watchType)
        ? [event.jurisdiction]
        : watchType === "document"
          ? [event.title, event.document_id && String(event.document_id)]
          : [];
  if (exactFields.length) {
    return exactFields.some((value) => normalizeValue(value).toLowerCase() === needle);
  }
  const searchable = [event.title, event.summary, event.category, event.document_type]
    .map((value) => normalizeValue(value).toLowerCase()).filter(Boolean);
  return searchable.some((value) => value.includes(needle));
};

const refreshWatchlists = async (userId, adapters = {}) => {
  const runQuery = adapters.query || query;
  const watchlists = adapters.watchlists || (await listWatchlists(userId, runQuery));
  const eventResult = adapters.events
    ? { rows: adapters.events }
    : await runQuery(
      `SELECT id, event_type, title, summary, document_id, source_name, source_url,
              document_type, jurisdiction, authority, ministry, category, status,
              event_date, importance_score, metadata_json, created_at
       FROM intelligence_events
       WHERE source_url IS NOT NULL AND BTRIM(source_url) <> ''
         AND source_name IS NOT NULL AND BTRIM(source_name) <> ''
       ORDER BY COALESCE(event_date, created_at::date) DESC, importance_score DESC
       LIMIT 250`,
    );
  const created = [];
  for (const watchlist of watchlists) {
    for (const event of eventResult.rows.filter((item) =>
      normalizeValue(item.source_name) && normalizeValue(item.source_url)
      && eventMatches(watchlist, item)).slice(0, 25)) {
      const watchType = watchlist.watch_type || watchlist.watchType;
      const watchValue = watchlist.watch_value || watchlist.watchValue;
      const why = `${watchType} matches “${watchValue}” in the verified event metadata.`;
      const verifiedChange = normalizeValue(event.summary, 500) || normalizeValue(event.title, 500);
      const impact = `${event.event_type || "Regulatory event"}: ${verifiedChange}. `
        + `Review the cited source to determine its effect on your work.`;
      const evidence = {
        eventType: event.event_type, matchedField: watchType,
        matchedValue: watchValue, documentId: event.document_id || null,
        authority: event.authority || null, ministry: event.ministry || null,
        jurisdiction: event.jurisdiction || null, category: event.category || null,
      };
      const result = await runQuery(
        `INSERT INTO regulatory_alerts
           (user_id, watchlist_id, intelligence_event_id, title, why_triggered,
            impact_summary, source_name, source_url, event_date, evidence_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         ON CONFLICT (watchlist_id, intelligence_event_id) DO NOTHING
         RETURNING *`,
        [userId, watchlist.id, event.id, event.title, why, impact, event.source_name,
          event.source_url, event.event_date || null, JSON.stringify(evidence)],
      );
      if (result.rows[0]) created.push(mapAlert(result.rows[0]));
    }
    await runQuery(
      `UPDATE research_watchlists SET last_checked_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2`, [watchlist.id, userId],
    );
  }
  return { checked: watchlists.length, created: created.length, alerts: created };
};

const listAlerts = async (userId, adapter = query) => {
  const result = await adapter(
    `SELECT * FROM regulatory_alerts WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 100`, [userId],
  );
  return result.rows.map(mapAlert);
};

module.exports = {
  WATCH_TYPES, createWatchlist, deleteWatchlist, eventMatches, listAlerts,
  listWatchlists, refreshWatchlists, validateWatchlist,
};
