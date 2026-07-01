const { query } = require("../db");
const { getActivityInsights } = require("../activity/activityService");
const { generateDashboardOverview } = require("../lib/vectordb");

let overviewCache = {
  key: null,
  value: null,
  expiresAt: 0,
};

const SOURCE_REGISTRY = [
  {
    key: "prs-india",
    label: "PRS Legislative Research",
    purpose: "Bills, Acts, legislative briefs and state coverage",
  },
  {
    key: "digital-sansad",
    label: "Digital Sansad",
    purpose: "Unified Parliament business, debates and questions",
  },
  {
    key: "lok-sabha",
    label: "Lok Sabha",
    purpose: "Business lists, questions, debates and committees",
  },
  {
    key: "rajya-sabha",
    label: "Rajya Sabha",
    purpose: "Bills, questions, debates and proceedings",
  },
  {
    key: "egazette",
    label: "eGazette of India",
    purpose: "Official notifications, rules, orders and Gazettes",
  },
  {
    key: "india-code",
    label: "India Code",
    purpose: "Official Acts and subordinate legislation",
  },
  {
    key: "ministry",
    label: "Ministries & Departments",
    purpose: "Policies, schemes, guidelines and consultations",
  },
  {
    key: "ministry-environment",
    label: "Ministry of Environment, Forest and Climate Change",
    purpose: "Official environmental guidelines, schemes and reports",
  },
  {
    key: "state-legislature",
    label: "State Legislatures",
    purpose: "State Bills, Acts and Assembly proceedings",
  },
  {
    key: "state-gazette",
    label: "State Gazettes",
    purpose: "State notifications, rules, orders and ordinances",
  },
  {
    key: "state-directory",
    label: "All States & Union Territories",
    purpose: "Official IGOD discovery for all 36 state and UT jurisdictions",
  },
  {
    key: "niti-aayog",
    label: "NITI Aayog",
    purpose: "Policy reports, strategy papers, white papers and recommendations",
  },
  {
    key: "pib",
    label: "Press Information Bureau",
    purpose: "Cabinet decisions, policy announcements and ministry releases",
  },
  {
    key: "mygov",
    label: "MyGov",
    purpose: "Public consultations, draft policies and citizen discussions",
  },
  {
    key: "ndap",
    label: "NDAP",
    purpose: "Official public-data catalogue discovery",
  },
  {
    key: "ogd-india",
    label: "Open Government Data Platform India",
    purpose: "Official public datasets and catalogue metadata",
  },
  ...[
    ["rbi", "Reserve Bank of India"],
    ["sebi", "Securities and Exchange Board of India"],
    ["trai", "Telecom Regulatory Authority of India"],
    ["uidai", "Unique Identification Authority of India"],
    ["cci", "Competition Commission of India"],
    ["cerc", "Central Electricity Regulatory Commission"],
    ["irdai", "Insurance Regulatory and Development Authority"],
    ["pfrda", "Pension Fund Regulatory and Development Authority"],
    ["nmc", "National Medical Commission"],
    ["aicte", "All India Council for Technical Education"],
    ["ugc", "University Grants Commission"],
    ["ec", "Election Commission of India"],
    ["nclt", "National Company Law Tribunal"],
    ["nclat", "National Company Law Appellate Tribunal"],
    ["gst-council", "Goods and Services Tax Council"],
    ["cbdt", "Central Board of Direct Taxes"],
    ["cbic", "Central Board of Indirect Taxes and Customs"],
  ].map(([key, label]) => ({
    key: `regulator-${key}`,
    label,
    purpose: "Official regulations, circulars, orders and consultations",
  })),
];

const toIso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const deriveSourceStatus = ({
  documentCount = 0,
  latestRun,
  latestSnapshot,
  now = Date.now(),
}) => {
  if (!latestRun && !latestSnapshot && !documentCount) return "Not Run";

  const errors = JSON.stringify(latestRun?.errors_json || []);
  const isBlocked = /robots|captcha|blocked|forbidden|interactive|timeout|403|unreachable/i.test(errors);

  if (latestRun?.status === "failed") {
    return isBlocked ? "Blocked" : "Error";
  }
  if (latestRun?.status === "completed_with_errors") {
    return isBlocked ? "Blocked" : "Degraded";
  }

  const freshnessDate =
    latestRun?.completed_at ||
    latestSnapshot?.collected_at ||
    latestSnapshot?.fetched_at;
  if (!freshnessDate) return "Connected";
  const ageDays = (now - new Date(freshnessDate).getTime()) / 86_400_000;
  return ageDays <= 7 ? "Fresh" : "Stale";
};

const mapDocument = (row) => ({
  id: String(row.id),
  canonicalId: row.canonical_id,
  title: row.title,
  documentType: row.document_type,
  jurisdictionLevel: row.jurisdiction_level,
  jurisdiction: row.jurisdiction,
  authority: row.authority,
  ministry: row.ministry,
  department: row.department,
  category: row.category,
  gazetteNumber: row.gazette_identifier || row.gazette_id || null,
  status: row.status,
  year: row.year,
  sourceName: row.canonical_source || row.source_name,
  sourceUrl: row.canonical_url || row.detail_url || row.source_url,
  pdfUrl: row.pdf_url,
  eventDate: toIso(
    row.intelligence_date ||
      row.publication_date ||
      row.enacted_date ||
      row.introduced_date ||
      row.first_seen_at,
  ),
  firstSeenAt: toIso(row.first_seen_at),
  updatedAt: toIso(row.updated_at),
  recommendationScore:
    row.recommendation_score == null
      ? null
      : Number(row.recommendation_score),
});

const mapEvent = (row) => ({
  id: String(row.id),
  eventType: row.event_type,
  title: row.title,
  summary: row.summary,
  documentId: row.document_id ? String(row.document_id) : null,
  documentType: row.document_type,
  sourceName: row.source_name,
  sourceUrl: row.source_url,
  pdfUrl: row.pdf_url,
  jurisdiction: row.jurisdiction,
  authority: row.authority,
  ministry: row.ministry,
  category: row.category,
  status: row.status,
  eventDate: toIso(row.event_date),
  importanceScore: Number(row.importance_score || 0),
  createdAt: toIso(row.created_at),
  isFallback: false,
});

const mapChat = (row) => ({
  id: String(row.id),
  documentId: String(row.document_id),
  documentType: row.document_type,
  title: row.title,
  status: row.status,
  pdfUrl: row.pdf_url,
  summary: row.summary,
  messageCount: Number(row.message_count || 0),
  updatedAt: toIso(row.updated_at),
});

const getRecentUserChats = async (userId, limit = 8) => {
  const result = await query(
    `SELECT
       id,
       document_id,
       document_type,
       document_title AS title,
       status,
       pdf_url,
       LEFT(summary, 280) AS summary,
       JSONB_ARRAY_LENGTH(messages) AS message_count,
       GREATEST(last_accessed_at, last_message_at, updated_at) AS updated_at
     FROM document_chats
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY is_pinned DESC, updated_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map(mapChat);
};

const getSourceHealth = async () => {
  const [runs, snapshots, counts] = await Promise.all([
    query(`
      SELECT DISTINCT ON (source_name)
        source_name,
        collection_name,
        status,
        started_at,
        completed_at,
        counters_json,
        errors_json
      FROM ingestion_runs
      ORDER BY source_name, started_at DESC
    `),
    query(`
      SELECT DISTINCT ON (source_name)
        source_name,
        source_url,
        response_status,
        record_count,
        fetched_at,
        collected_at
      FROM source_collection_snapshots
      ORDER BY source_name, COALESCE(collected_at, fetched_at) DESC
    `),
    query(`
      SELECT source_name, COUNT(*)::INTEGER AS documents
      FROM document_sources
      GROUP BY source_name
    `),
  ]);

  const runBySource = new Map(
    runs.rows.map((row) => [row.source_name, row]),
  );
  const snapshotBySource = new Map(
    snapshots.rows.map((row) => [row.source_name, row]),
  );
  const countBySource = new Map(
    counts.rows.map((row) => [row.source_name, row.documents]),
  );

  return SOURCE_REGISTRY.map((source) => {
    const latestRun = runBySource.get(source.key);
    const latestSnapshot = snapshotBySource.get(source.key);
    const documentCount = countBySource.get(source.key) || 0;
    return {
      ...source,
      status: deriveSourceStatus({
        documentCount,
        latestRun,
        latestSnapshot,
      }),
      documentCount,
      lastRefresh: toIso(
        latestRun?.completed_at ||
          latestSnapshot?.collected_at ||
          latestSnapshot?.fetched_at,
      ),
      latestRunStatus: latestRun?.status || null,
      latestCollection: latestRun?.collection_name || null,
      latestSnapshotUrl: latestSnapshot?.source_url || null,
      errorCount: Array.isArray(latestRun?.errors_json)
        ? latestRun.errors_json.length
        : 0,
    };
  });
};

const buildBriefSummary = ({
  recentEventCount,
  freshSourceCount,
  recentDocumentCount,
}) => {
  if (recentEventCount > 0) {
    return `${recentEventCount} verified legislative update${
      recentEventCount === 1 ? "" : "s"
    } were published in the last seven days across ${freshSourceCount} fresh source${
      freshSourceCount === 1 ? "" : "s"
    }.`;
  }
  if (recentDocumentCount > 0) {
    return `No current Parliament event feed is connected yet. ${recentDocumentCount} recently catalogued document${
      recentDocumentCount === 1 ? "" : "s"
    } are shown from stored source data.`;
  }
  return "No current legislative events have been ingested yet. Connected sources will appear here after their next refresh.";
};

const buildRecentActivity = ({
  recentEventCount24h = 0,
  recentEventCount = 0,
  recentDocumentCount24h = 0,
  recentDocumentCount = 0,
}) => ({
  last24Hours: recentEventCount24h || recentDocumentCount24h,
  last7Days: recentEventCount || recentDocumentCount,
});

const findLatestDatedEvent = (events) =>
  events.reduce((latest, event) => {
    if (!event.eventDate) return latest;
    if (!latest) return event;
    return new Date(event.eventDate).getTime() >
      new Date(latest.eventDate).getTime()
      ? event
      : latest;
  }, null);

const getGreeting = (name) => {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${greeting}, ${name.split(" ")[0]}` : greeting;
};

const getGroundedOverview = async (evidence, fallback) => {
  if (!process.env.OPENAI_API_KEY) return fallback;
  const key = JSON.stringify(evidence);
  if (
    overviewCache.key === key &&
    overviewCache.value &&
    overviewCache.expiresAt > Date.now()
  ) {
    return overviewCache.value;
  }
  try {
    const value = await generateDashboardOverview(evidence);
    if (!value) return fallback;
    overviewCache = {
      key,
      value,
      expiresAt: Date.now() + 15 * 60 * 1_000,
    };
    return value;
  } catch (error) {
    console.warn("Dashboard overview generation unavailable:", error.message);
    return fallback;
  }
};

const getDashboardIntelligence = async (userId) => {
  const [
    user,
    eventsResult,
    recentDocumentsResult,
    nationalUpdatesResult,
    latestStateBillsResult,
    activeBillsResult,
    gazetteNotificationsResult,
    legalUpdatesResult,
    trendingResult,
    ministryActivityResult,
    developmentCountsResult,
    recommendedReadingResult,
    refreshResult,
    recentCountsResult,
    sourceHealth,
    recentUserChats,
  ] = await Promise.all([
    query(
      `SELECT id, name, email, avatar, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    ),
    query(`
      SELECT e.*, d.pdf_url
      FROM intelligence_events e
      LEFT JOIN legislative_documents d ON d.id = e.document_id
      ORDER BY
        e.importance_score DESC NULLS LAST,
        e.event_date DESC NULLS LAST,
        e.created_at DESC
      LIMIT 20
    `),
    query(`
      SELECT *
      FROM legislative_documents
      ORDER BY
        first_seen_at DESC NULLS LAST,
        updated_at DESC,
        id DESC
      LIMIT 12
    `),
    query(`
      SELECT
        legislative_documents.*,
        COALESCE(
          publication_date,
          enacted_date,
          effective_date,
          first_seen_at::DATE
        ) AS intelligence_date
      FROM legislative_documents
      WHERE document_type IN (
        'act', 'policy', 'strategy_paper', 'white_paper',
        'discussion_paper', 'recommendation', 'notification',
        'gazette', 'committee_report', 'consultation_paper',
        'cabinet_decision', 'press_release', 'report', 'rule',
        'regulation', 'circular', 'order', 'office_memorandum',
        'guideline', 'scheme'
      )
         OR source_name LIKE 'regulator-%'
         OR canonical_source LIKE 'regulator-%'
      ORDER BY intelligence_date DESC NULLS LAST, updated_at DESC, id DESC
      LIMIT 100
    `),
    query(`
      SELECT
        legislative_documents.*,
        COALESCE(
          introduced_date,
          publication_date,
          CASE
            WHEN year BETWEEN 1800 AND 2200 THEN MAKE_DATE(year, 1, 1)
          END,
          first_seen_at::DATE
        ) AS intelligence_date
      FROM legislative_documents
      WHERE document_type = 'bill'
        AND jurisdiction_level = 'state'
      ORDER BY
        intelligence_date DESC NULLS LAST,
        updated_at DESC,
        id DESC
      LIMIT 8
    `),
    query(`
      SELECT
        legislative_documents.*,
        COALESCE(
          introduced_date,
          CASE
            WHEN year BETWEEN 1800 AND 2200 THEN MAKE_DATE(year, 1, 1)
          END
        ) AS intelligence_date
      FROM legislative_documents
      WHERE document_type = 'bill'
        AND jurisdiction_level IN ('parliament', 'union')
        AND LOWER(COALESCE(status, '')) ~
          '(introduced|pending|consideration|passed|referred|committee)'
      ORDER BY
        intelligence_date DESC NULLS LAST,
        updated_at DESC,
        id DESC
      LIMIT 8
    `),
    query(`
      SELECT
        legislative_documents.*,
        COALESCE(
          publication_date,
          effective_date,
          first_seen_at::DATE
        ) AS intelligence_date
      FROM legislative_documents
      WHERE (
        canonical_source IN ('egazette', 'state-gazette')
        OR source_name IN ('egazette', 'state-gazette')
        OR gazette_identifier IS NOT NULL
        OR document_type = 'gazette'
      )
      ORDER BY
        intelligence_date DESC NULLS LAST,
        updated_at DESC,
        id DESC
      LIMIT 8
    `),
    query(`
      SELECT
        legislative_documents.*,
        COALESCE(
          publication_date,
          enacted_date,
          effective_date,
          CASE
            WHEN year BETWEEN 1800 AND 2200 THEN MAKE_DATE(year, 1, 1)
          END
        ) AS intelligence_date
      FROM legislative_documents
      WHERE document_type IN (
        'act', 'rule', 'regulation', 'notification', 'gazette',
        'ordinance', 'policy', 'circular', 'order'
      )
      ORDER BY
        intelligence_date DESC NULLS LAST,
        updated_at DESC,
        id DESC
      LIMIT 8
    `),
    query(`
      SELECT label, COUNT(*)::INTEGER AS documents
      FROM (
        SELECT COALESCE(NULLIF(ministry, ''), NULLIF(category, '')) AS label
        FROM legislative_documents
      ) categories
      WHERE label IS NOT NULL
      GROUP BY label
      ORDER BY documents DESC, label
      LIMIT 12
    `),
    query(`
      SELECT
        ministry,
        COUNT(*)::INTEGER AS documents,
        MAX(
          COALESCE(publication_date::TIMESTAMPTZ, updated_at)
        ) AS latest_activity
      FROM legislative_documents
      WHERE ministry IS NOT NULL AND ministry <> ''
      GROUP BY ministry
      ORDER BY latest_activity DESC, documents DESC, ministry
      LIMIT 10
    `),
    query(`
      SELECT document_type, COUNT(*)::INTEGER AS documents
      FROM legislative_documents
      WHERE first_seen_at >= NOW() - INTERVAL '30 days'
      GROUP BY document_type
      ORDER BY documents DESC, document_type
    `),
    query(
      `WITH preferences AS (
         SELECT
           COALESCE(preferred_ministries, '[]'::jsonb) AS ministries,
           COALESCE(preferred_policy_areas, '[]'::jsonb) AS policy_areas,
           COALESCE(preferred_jurisdictions, '[]'::jsonb) AS jurisdictions,
           COALESCE(preferred_document_types, '[]'::jsonb) AS document_types
         FROM user_profiles
         WHERE user_id = $1
       )
       SELECT
         d.*,
         (
           CASE WHEN preferences.ministries ? COALESCE(d.ministry, '')
             THEN 4 ELSE 0 END
           + CASE WHEN preferences.policy_areas ? COALESCE(d.category, '')
             THEN 3 ELSE 0 END
           + CASE WHEN preferences.jurisdictions ? COALESCE(d.jurisdiction, '')
             THEN 2 ELSE 0 END
           + CASE WHEN preferences.document_types ? d.document_type
             THEN 2 ELSE 0 END
         ) AS recommendation_score
       FROM legislative_documents d
       CROSS JOIN (
         SELECT * FROM preferences
         UNION ALL
         SELECT '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
         WHERE NOT EXISTS (SELECT 1 FROM preferences)
       ) preferences
       ORDER BY
         recommendation_score DESC,
         d.source_priority ASC,
         COALESCE(d.publication_date, d.enacted_date, d.introduced_date)
           DESC NULLS LAST,
         d.updated_at DESC
       LIMIT 8`,
      [userId],
    ),
    query(`
      SELECT completed_at, status, source_name
      FROM ingestion_runs
      WHERE completed_at IS NOT NULL
        AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `),
    query(`
      SELECT
        (
          SELECT COUNT(*)::INTEGER
          FROM intelligence_events
          WHERE event_date >= CURRENT_DATE - INTERVAL '24 hours'
        ) AS recent_events_24h,
        (
          SELECT COUNT(*)::INTEGER
          FROM intelligence_events
          WHERE event_date >= CURRENT_DATE - INTERVAL '7 days'
        ) AS recent_events,
        (
          SELECT COUNT(*)::INTEGER
          FROM legislative_documents
          WHERE first_seen_at >= NOW() - INTERVAL '24 hours'
        ) AS recent_documents_24h,
        (
          SELECT COUNT(*)::INTEGER
          FROM legislative_documents
          WHERE first_seen_at >= NOW() - INTERVAL '7 days'
        ) AS recent_documents
    `),
    getSourceHealth(),
    getRecentUserChats(userId, 8),
  ]);

  const recentDocuments = recentDocumentsResult.rows.map(mapDocument);
  const nationalUpdates = nationalUpdatesResult.rows.map(mapDocument);
  const latestBy = (predicate, limit = 8) =>
    nationalUpdates.filter(predicate).slice(0, limit);
  const storedEvents = eventsResult.rows.map(mapEvent);
  const intelligenceEvents = storedEvents.length
    ? storedEvents
    : recentDocuments.slice(0, 10).map((document) => ({
        ...document,
        eventType: "document_added",
        documentId: document.id,
        summary: null,
        importanceScore: 0,
        createdAt: document.firstSeenAt,
        isFallback: true,
      }));
  const freshSourceCount = sourceHealth.filter(
    (source) => source.status === "Fresh",
  ).length;
  const connectedSourceCount = sourceHealth.filter(
    (source) =>
      ["Fresh", "Stale", "Connected", "Degraded"].includes(source.status),
  ).length;
  const recentEventCount24h =
    recentCountsResult.rows[0]?.recent_events_24h || 0;
  const recentEventCount = recentCountsResult.rows[0]?.recent_events || 0;
  const recentDocumentCount24h =
    recentCountsResult.rows[0]?.recent_documents_24h || 0;
  const recentDocumentCount =
    recentCountsResult.rows[0]?.recent_documents || 0;
  const latestEvent = findLatestDatedEvent(storedEvents);
  const userRow = user.rows[0];
  const fallbackBrief = buildBriefSummary({
    recentEventCount,
    freshSourceCount,
    recentDocumentCount,
  });
  const briefSummary = await getGroundedOverview(
    {
      verifiedEventsLast7Days: Number(recentEventCount),
      cataloguedDocumentsLast7Days: Number(recentDocumentCount),
      freshSourceCount,
      latestVerifiedEvent: latestEvent
        ? {
            title: latestEvent.title,
            date: latestEvent.eventDate,
            type: latestEvent.documentType,
          }
        : null,
      recentCatalogueTitles: recentDocuments.slice(0, 3).map((document) => ({
        title: document.title,
        type: document.documentType,
        date: document.eventDate,
      })),
    },
    fallbackBrief,
  );

  return {
    userGreeting: getGreeting(userRow?.name),
    currentDate: new Date().toISOString(),
    lastRefresh: toIso(refreshResult.rows[0]?.completed_at),
    freshnessStatus: {
      freshSources: freshSourceCount,
      connectedSources: connectedSourceCount,
      totalSources: sourceHealth.length,
      label:
        freshSourceCount > 0
          ? `${freshSourceCount} sources fresh`
          : "Awaiting source refresh",
    },
    briefSummary,
    recentActivity: buildRecentActivity({
      recentEventCount24h,
      recentEventCount,
      recentDocumentCount24h,
      recentDocumentCount,
    }),
    whatChangedRecently: latestEvent
      ? `Latest verified update: ${latestEvent.title}`
      : "No live Parliament events have been ingested yet; showing recent catalogue additions.",
    intelligenceEvents,
    recentDocuments,
    latestActs: latestBy((document) => document.documentType === "act"),
    latestPolicies: latestBy((document) =>
      [
        "policy",
        "scheme",
        "guideline",
        "office_memorandum",
        "circular",
        "consultation_paper",
        "strategy_paper",
        "white_paper",
        "discussion_paper",
        "recommendation",
        "report",
        "government_resolution",
        "cabinet_decision",
      ].includes(document.documentType),
    ),
    latestMinistryUpdates: latestBy(
      (document) =>
        Boolean(document.ministry) &&
        ["pib", "niti-aayog", "ministry"].includes(document.sourceName),
    ),
    latestStateUpdates: latestBy(
      (document) => document.jurisdictionLevel === "state",
    ),
    latestStateBills: latestStateBillsResult.rows.map(mapDocument),
    latestRegulatorUpdates: latestBy((document) =>
      String(document.sourceName || "").startsWith("regulator-"),
    ),
    committeeActivity: latestBy(
      (document) => document.documentType === "committee_report",
    ),
    publicConsultations: latestBy(
      (document) => document.documentType === "consultation_paper",
    ),
    cabinetDecisions: latestBy(
      (document) => document.documentType === "cabinet_decision",
    ),
    activeBills: activeBillsResult.rows.map(mapDocument),
    latestLegalUpdates: legalUpdatesResult.rows.map(mapDocument),
    recentGazetteNotifications:
      gazetteNotificationsResult.rows.map(mapDocument),
    trendingCategories: trendingResult.rows
      .filter((row) => Number(row.documents) >= 2)
      .map((row) => ({
        label: row.label,
        documentCount: row.documents,
      })),
    ministryActivity: ministryActivityResult.rows.map((row) => ({
      ministry: row.ministry,
      documentCount: row.documents,
      latestActivity: toIso(row.latest_activity),
    })),
    majorDevelopments: developmentCountsResult.rows.map((row) => ({
      documentType: row.document_type,
      documentCount: row.documents,
    })),
    recommendedReading: recommendedReadingResult.rows
      .map(mapDocument)
      .filter((document) => document.recommendationScore >= 3),
    demoHighlights: [
      latestBy((document) => document.documentType === "act", 1)[0],
      activeBillsResult.rows.map(mapDocument)[0],
      latestStateBillsResult.rows.map(mapDocument)[0],
      latestBy((document) =>
        [
          "policy",
          "scheme",
          "guideline",
          "consultation_paper",
        ].includes(document.documentType),
      1)[0],
      gazetteNotificationsResult.rows.map(mapDocument)[0],
    ].filter(
      (document, index, documents) =>
        document &&
        documents.findIndex((candidate) => candidate?.id === document.id) ===
          index,
    ),
    sourceHealth,
    recentUserChats,
    emptyStateFlags: {
      noLiveEvents: storedEvents.length === 0,
      noActiveBills: activeBillsResult.rows.length === 0,
    },
  };
};

const getProfileData = async (userId) => {
  const [
    user,
    activity,
    coverage,
    typeCounts,
    lastRun,
    recentChats,
    sources,
    activityInsights,
    favoriteGazetteCategories,
  ] = await Promise.all([
      query(
        `SELECT
           id, name, email, avatar, google_id, is_admin, created_at
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId],
      ),
      query(
        `SELECT
           COUNT(*) FILTER (
             WHERE document_type = 'bill'
               AND NOT EXISTS (
                 SELECT 1
                 FROM legislative_documents d
                 WHERE d.id::TEXT = document_chats.document_id::TEXT
                   AND d.jurisdiction_level = 'state'
               )
           )::INTEGER AS bill_chats,
           COUNT(*) FILTER (
             WHERE document_type = 'bill'
               AND EXISTS (
                 SELECT 1
                 FROM legislative_documents d
                 WHERE d.id::TEXT = document_chats.document_id::TEXT
                   AND d.jurisdiction_level = 'state'
               )
           )::INTEGER AS state_bill_chats,
           COUNT(*) FILTER (
             WHERE document_type = 'act'
           )::INTEGER AS act_chats,
           COUNT(*) FILTER (
             WHERE document_type = 'gazette'
           )::INTEGER AS gazette_chats,
           COUNT(*) FILTER (
             WHERE document_type IN (
               'policy', 'scheme', 'guideline', 'consultation_paper',
               'strategy_paper', 'white_paper', 'discussion_paper',
               'recommendation', 'report', 'government_resolution',
               'cabinet_decision'
             )
           )::INTEGER AS policy_chats,
           (
             SELECT COUNT(DISTINCT i.document_id)::INTEGER
             FROM user_document_interactions i
             JOIN legislative_documents d ON d.id = i.document_id
             WHERE i.user_id = $1
               AND (
                 d.canonical_source IN ('egazette', 'state-gazette')
                 OR d.source_name IN ('egazette', 'state-gazette')
                 OR d.gazette_identifier IS NOT NULL
                 OR d.document_type = 'gazette'
               )
           ) AS gazette_documents_opened,
           COUNT(*) FILTER (
             WHERE summary IS NOT NULL AND summary <> ''
           )::INTEGER AS saved_summaries,
           COALESCE(SUM(JSONB_ARRAY_LENGTH(messages)), 0)::INTEGER
             AS total_messages
         FROM document_chats
         WHERE user_id = $1 AND is_active = TRUE`,
        [userId],
      ),
      query(`
        SELECT
          COUNT(*)::INTEGER AS total_documents,
          COUNT(pdf_url)::INTEGER AS documents_with_pdf,
          COUNT(DISTINCT jurisdiction)::INTEGER AS jurisdictions,
          (
            SELECT COUNT(*)::INTEGER
            FROM legislative_document_resources
          ) AS source_resources,
          COUNT(*) FILTER (
            WHERE document_type = 'bill'
              AND jurisdiction_level IN ('parliament', 'union')
          )::INTEGER AS parliament_bills,
          COUNT(*) FILTER (
            WHERE document_type = 'act'
              AND jurisdiction_level IN ('parliament', 'union')
          )::INTEGER AS parliament_acts,
          COUNT(*) FILTER (
            WHERE document_type = 'bill'
              AND jurisdiction_level = 'state'
          )::INTEGER AS state_bills,
          COUNT(*) FILTER (
            WHERE document_type = 'act'
              AND jurisdiction_level = 'state'
          )::INTEGER AS state_acts,
          COUNT(*) FILTER (
            WHERE document_type IN (
              'policy', 'scheme', 'guideline', 'consultation_paper',
              'strategy_paper', 'white_paper', 'discussion_paper',
              'recommendation', 'report', 'government_resolution',
              'cabinet_decision'
            )
          )::INTEGER AS policy_documents,
          COUNT(*) FILTER (
            WHERE source_name LIKE 'regulator-%'
               OR canonical_source LIKE 'regulator-%'
          )::INTEGER AS regulator_documents,
          (
            SELECT COUNT(*)::INTEGER
            FROM source_directory_entries
            WHERE entity_type = 'ministry'
          ) AS ministries_discovered,
          (
            SELECT COUNT(*)::INTEGER
            FROM source_directory_entries
            WHERE entity_type = 'state_or_union_territory'
          ) AS states_discovered,
          COUNT(*) FILTER (
            WHERE canonical_source IN ('egazette', 'state-gazette')
              OR source_name IN ('egazette', 'state-gazette')
              OR gazette_identifier IS NOT NULL
              OR document_type = 'gazette'
          )::INTEGER AS gazette_documents
        FROM legislative_documents
      `),
      query(`
        SELECT document_type, COUNT(*)::INTEGER AS documents
        FROM legislative_documents
        GROUP BY document_type
        ORDER BY documents DESC, document_type
      `),
      query(`
        SELECT
          source_name,
          collection_name,
          status,
          records_discovered,
          records_stored,
          completed_at
        FROM ingestion_runs
        WHERE completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 1
      `),
      getRecentUserChats(userId, 12),
      getSourceHealth(),
      getActivityInsights(userId),
      query(
        `SELECT
           COALESCE(NULLIF(d.category, ''), NULLIF(d.ministry, ''), d.document_type)
             AS label,
           SUM(i.count)::INTEGER AS interactions
         FROM user_document_interactions i
         JOIN legislative_documents d ON d.id = i.document_id
         WHERE i.user_id = $1
           AND (
             d.canonical_source IN ('egazette', 'state-gazette')
             OR d.source_name IN ('egazette', 'state-gazette')
             OR d.gazette_identifier IS NOT NULL
             OR d.document_type = 'gazette'
           )
         GROUP BY label
         ORDER BY interactions DESC, label
         LIMIT 6`,
        [userId],
      ),
    ]);

  if (!user.rows[0]) return null;
  const userRow = user.rows[0];
  const activityRow = activity.rows[0];
  const coverageRow = coverage.rows[0];
  const researchHistoryCount =
    activityRow.bill_chats +
    activityRow.state_bill_chats +
    activityRow.act_chats +
    activityRow.policy_chats +
    activityRow.gazette_chats;

  return {
    user: {
      id: String(userRow.id),
      name: userRow.name,
      email: userRow.email,
      avatar: userRow.avatar,
      initials: userRow.name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
      accountType: userRow.is_admin ? "Administrator" : "Researcher",
      authenticationProvider: userRow.google_id ? "Google" : "Email",
      joinedAt: toIso(userRow.created_at),
    },
    userActivityStats: {
      billChats: activityRow.bill_chats,
      stateBillChats: activityRow.state_bill_chats,
      actChats: activityRow.act_chats,
      policyChats: activityRow.policy_chats,
      gazetteChats: activityRow.gazette_chats,
      gazetteDocumentsOpened: activityRow.gazette_documents_opened,
      researchHistoryCount,
      savedSummaries: activityRow.saved_summaries,
      totalMessages: activityRow.total_messages,
    },
    platformCoverageStats: {
      totalDocuments: coverageRow.total_documents,
      documentsWithPdf: coverageRow.documents_with_pdf,
      jurisdictions: coverageRow.jurisdictions,
      sourceResources: coverageRow.source_resources,
      parliamentBills: coverageRow.parliament_bills,
      parliamentActs: coverageRow.parliament_acts,
      stateBills: coverageRow.state_bills,
      stateActs: coverageRow.state_acts,
      policyDocuments: coverageRow.policy_documents,
      regulatorDocuments: coverageRow.regulator_documents,
      ministriesDiscovered: coverageRow.ministries_discovered,
      statesDiscovered: coverageRow.states_discovered,
      gazetteDocuments: coverageRow.gazette_documents,
      byDocumentType: typeCounts.rows.map((row) => ({
        documentType: row.document_type,
        documents: row.documents,
      })),
      lastCollection: lastRun.rows[0]
        ? {
            sourceName: lastRun.rows[0].source_name,
            collectionName: lastRun.rows[0].collection_name,
            status: lastRun.rows[0].status,
            recordsDiscovered: lastRun.rows[0].records_discovered,
            recordsStored: lastRun.rows[0].records_stored,
            completedAt: toIso(lastRun.rows[0].completed_at),
          }
        : null,
    },
    recentChats,
    recentGazetteResearch: recentChats.filter(
      (chat) => chat.documentType === "gazette",
    ),
    favoriteGazetteCategories: favoriteGazetteCategories.rows.map((row) => ({
      label: row.label,
      interactions: row.interactions,
    })),
    sourceConnections: sources,
    activityInsights,
  };
};

module.exports = {
  SOURCE_REGISTRY,
  buildBriefSummary,
  buildRecentActivity,
  deriveSourceStatus,
  findLatestDatedEvent,
  getDashboardIntelligence,
  getProfileData,
  getRecentUserChats,
  getSourceHealth,
  mapDocument,
};
