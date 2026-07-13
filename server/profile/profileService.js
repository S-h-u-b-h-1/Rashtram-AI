const bcrypt = require("bcryptjs");
const { connectDB, getPool, query } = require("../db");
const { normalizePayload } = require("../onboarding/onboardingService");

const text = (value, max = 500) => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, max) : null;
};

const list = (value, limit = 30) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .map((item) => text(item, 120))
            .filter(Boolean)
            .slice(0, limit),
        ),
      ]
    : [];

const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const mapProfile = (row) => ({
  name: row.name,
  email: row.email,
  avatar: row.avatar,
  username: row.username,
  bio: row.bio,
  organization: row.organization,
  role: row.role,
  designation: row.designation,
  location: row.location,
  phone: row.phone,
  timezone: row.timezone || "Asia/Kolkata",
  languagePreference: row.language_preference || "English",
  themePreference: row.theme_preference || "system",
  researchVisibility: row.research_visibility || "private",
  notificationPreferences: row.notification_preferences || {},
  researchInterests: row.research_interests || [],
  preferredMinistries: row.preferred_ministries || [],
  preferredPolicyAreas: row.preferred_policy_areas || [],
  preferredJurisdictions: row.preferred_jurisdictions || [],
  preferredDocumentTypes: row.preferred_document_types || [],
  preferredSources: row.preferred_sources || [],
  dashboardWidgets: row.dashboard_widgets || [],
  onboardingCompleted: Boolean(row.onboarding_completed),
  onboardingSkipped: Boolean(row.onboarding_skipped),
  onboardingCompletedAt: row.onboarding_completed_at || null,
  hasPassword: Boolean(row.password),
});

const getAccountData = async (userId) => {
  const [profile, saved, searches, collections, sessions, analytics, notes] =
    await Promise.all([
    query(
      `SELECT u.*, p.*
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [userId],
    ),
    query(
      `SELECT s.id, s.item_type, s.document_type, s.document_id, s.chat_id,
         s.title, s.metadata_json, s.created_at,
         d.pdf_url, d.processing_status,
         EXISTS (
           SELECT 1 FROM document_text_artifacts a
           WHERE a.document_id = d.id
         ) AS research_ready
       FROM saved_content s
       LEFT JOIN legislative_documents d
         ON d.id::TEXT = s.document_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [userId],
    ),
    query(
      `SELECT id, name, query_text, filters_json, created_at, updated_at
       FROM saved_searches
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId],
    ),
    query(
      `SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'documentType', i.document_type,
               'documentId', i.document_id,
               'title', i.title,
               'metadata', i.metadata_json
             )
             ORDER BY i.created_at DESC
           ) FILTER (WHERE i.document_id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM research_collections c
       LEFT JOIN research_collection_items i ON i.collection_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.updated_at DESC`,
      [userId],
    ),
    query(
      `SELECT id, user_agent, ip_address, expires_at, last_seen_at,
         revoked_at, created_at
       FROM user_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId],
    ),
    query(
      `WITH ordered_activity AS (
         SELECT
           session_id,
           event_type,
           created_at,
           LEAD(created_at) OVER (
             PARTITION BY session_id ORDER BY created_at
           ) AS next_at
         FROM user_activity_events
         WHERE user_id = $1
       ),
       activity_days AS (
         SELECT created_at::DATE AS day, COUNT(*)::INTEGER AS events
         FROM user_activity_events
         WHERE user_id = $1
         GROUP BY created_at::DATE
       )
       SELECT
         (
           SELECT COUNT(DISTINCT document_id)::INTEGER
           FROM user_activity_events
           WHERE user_id = $1 AND document_id IS NOT NULL
         ) AS documents_opened,
         (
           SELECT COUNT(DISTINCT session_id)::INTEGER
           FROM user_activity_events
           WHERE user_id = $1 AND session_id IS NOT NULL
         ) AS research_sessions,
         (
           SELECT COUNT(*)::INTEGER
           FROM user_activity_events
           WHERE user_id = $1 AND event_type = 'search_performed'
         ) AS searches,
         (
           SELECT COALESCE(
             ROUND(
               SUM(
                 LEAST(
                   EXTRACT(EPOCH FROM (next_at - created_at)),
                   1800
                 )
               ) / 60
             ),
             0
           )::INTEGER
           FROM ordered_activity
           WHERE next_at IS NOT NULL
             AND event_type IN (
               'document_opened',
               'bill_opened',
               'act_opened',
               'chat_started',
               'chat_message_sent',
               'summary_viewed'
             )
         ) AS reading_minutes,
         (
           SELECT TO_CHAR(day, 'FMDay')
           FROM activity_days
           ORDER BY events DESC, day DESC
           LIMIT 1
         ) AS most_active_day,
         (
           SELECT COUNT(*)::INTEGER
           FROM user_activity_events
           WHERE user_id = $1
             AND created_at >= NOW() - INTERVAL '7 days'
         ) AS weekly_activity,
         (
           SELECT COUNT(*)::INTEGER
           FROM user_activity_events
           WHERE user_id = $1
             AND created_at >= NOW() - INTERVAL '30 days'
         ) AS monthly_activity,
         (
           SELECT COUNT(*)::INTEGER
           FROM document_chats
           WHERE user_id = $1 AND is_active = TRUE
         ) AS chats_created,
         (
           SELECT COALESCE(SUM(JSONB_ARRAY_LENGTH(messages)), 0)::INTEGER
           FROM document_chats
           WHERE user_id = $1 AND is_active = TRUE
         ) AS messages_exchanged,
         (
           SELECT COUNT(*)::INTEGER
           FROM document_chats
           WHERE user_id = $1
             AND is_active = TRUE
             AND summary IS NOT NULL
             AND summary <> ''
         ) AS summaries_generated,
         (
           SELECT COALESCE(
             JSON_AGG(day ORDER BY day DESC),
             '[]'::json
           )
           FROM activity_days
         ) AS active_days`,
      [userId],
    ),
    query(
      `SELECT id, document_type, document_id, body, created_at, updated_at
       FROM research_notes
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId],
    ),
  ]);
  const analyticsRow = analytics.rows[0] || {};
  const activeDays = (analyticsRow.active_days || []).map((day) =>
    new Date(day).toISOString().slice(0, 10),
  );
  let researchStreak = 0;
  const cursor = new Date();
  for (const day of activeDays) {
    const expected = cursor.toISOString().slice(0, 10);
    if (day === expected) {
      researchStreak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else if (researchStreak === 0) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      if (day === cursor.toISOString().slice(0, 10)) {
        researchStreak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return {
    profile: profile.rows[0] ? mapProfile(profile.rows[0]) : null,
    savedContent: saved.rows.map((row) => ({
      id: String(row.id),
      itemType: row.item_type,
      documentType: row.document_type,
      documentId: row.document_id,
      chatId: row.chat_id ? String(row.chat_id) : null,
      title: row.title,
      metadata: row.metadata_json || {},
      pdfUrl: row.pdf_url,
      processingStatus: row.processing_status,
      researchReady: Boolean(row.research_ready),
      createdAt: row.created_at,
    })),
    savedSearches: searches.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      query: row.query_text,
      filters: row.filters_json || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    collections: collections.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      description: row.description,
      items: row.items || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    sessions: sessions.rows.map((row) => ({
      id: row.id,
      userAgent: row.user_agent,
      expiresAt: row.expires_at,
      lastSeenAt: row.last_seen_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
    })),
    analytics: {
      documentsOpened: analyticsRow.documents_opened || 0,
      savedDocuments: saved.rows.filter(
        (row) => row.item_type !== "bookmark",
      ).length,
      bookmarks: saved.rows.filter(
        (row) => row.item_type === "bookmark",
      ).length,
      readingHistory: analyticsRow.documents_opened || 0,
      researchSessions: analyticsRow.research_sessions || 0,
      recentSearches: analyticsRow.searches || 0,
      readingTimeMinutes: analyticsRow.reading_minutes || 0,
      mostActiveDay: analyticsRow.most_active_day?.trim() || null,
      weeklyActivity: analyticsRow.weekly_activity || 0,
      monthlyActivity: analyticsRow.monthly_activity || 0,
      researchStreak,
      summariesGenerated: analyticsRow.summaries_generated || 0,
      chatsCreated: analyticsRow.chats_created || 0,
      messagesExchanged: analyticsRow.messages_exchanged || 0,
    },
    notes: notes.rows.map((row) => ({
      id: String(row.id),
      documentType: row.document_type,
      documentId: row.document_id,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
};

const updateProfile = async (userId, payload) => {
  const name = text(payload.name, 120);
  if (!name) throw new Error("Name is required.");
  let avatar = text(payload.avatar, 1_000);
  if (avatar) {
    const parsed = new URL(avatar);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      throw new Error("Profile photo must use an HTTP or HTTPS URL.");
    }
  }
  const username = text(payload.username, 40);
  if (username && !/^[a-z0-9_]{3,40}$/i.test(username)) {
    throw new Error(
      "Username must be 3–40 letters, numbers, or underscores.",
    );
  }

  await query(
    `UPDATE users SET name = $1, avatar = $2 WHERE id = $3`,
    [name, avatar, userId],
  );
  const result = await query(
    `INSERT INTO user_profiles (
       user_id, username, bio, organization, role, designation, location, phone,
       timezone, language_preference, theme_preference, research_visibility,
       notification_preferences, research_interests, preferred_ministries,
       preferred_policy_areas, preferred_jurisdictions,
       preferred_document_types, preferred_sources, dashboard_widgets,
       onboarding_completed, onboarding_skipped, onboarding_completed_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb,
       $18::jsonb, $19::jsonb, $20::jsonb, $21, $22,
       CASE WHEN $21 OR $22 THEN NOW() ELSE NULL END
     )
     ON CONFLICT (user_id) DO UPDATE SET
       username = EXCLUDED.username,
       bio = EXCLUDED.bio,
       organization = EXCLUDED.organization,
       role = EXCLUDED.role,
       designation = EXCLUDED.designation,
       location = EXCLUDED.location,
       phone = EXCLUDED.phone,
       timezone = EXCLUDED.timezone,
       language_preference = EXCLUDED.language_preference,
       theme_preference = EXCLUDED.theme_preference,
       research_visibility = EXCLUDED.research_visibility,
       notification_preferences = EXCLUDED.notification_preferences,
       research_interests = EXCLUDED.research_interests,
       preferred_ministries = EXCLUDED.preferred_ministries,
       preferred_policy_areas = EXCLUDED.preferred_policy_areas,
       preferred_jurisdictions = EXCLUDED.preferred_jurisdictions,
       preferred_document_types = EXCLUDED.preferred_document_types,
       preferred_sources = EXCLUDED.preferred_sources,
       dashboard_widgets = EXCLUDED.dashboard_widgets,
       onboarding_completed = CASE
         WHEN $23 THEN EXCLUDED.onboarding_completed
         ELSE user_profiles.onboarding_completed
       END,
       onboarding_skipped = CASE
         WHEN $23 THEN EXCLUDED.onboarding_skipped
         ELSE user_profiles.onboarding_skipped
       END,
       onboarding_completed_at = CASE
         WHEN $23 AND (EXCLUDED.onboarding_completed OR EXCLUDED.onboarding_skipped)
           THEN COALESCE(user_profiles.onboarding_completed_at, NOW())
         ELSE user_profiles.onboarding_completed_at
       END,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      username,
      text(payload.bio, 1_500),
      text(payload.organization, 160),
      text(payload.role, 80),
      text(payload.designation, 160),
      text(payload.location, 160),
      text(payload.phone, 40),
      text(payload.timezone, 80) || "Asia/Kolkata",
      text(payload.languagePreference, 40) || "English",
      text(payload.themePreference, 20) || "system",
      text(payload.researchVisibility, 20) || "private",
      JSON.stringify(object(payload.notificationPreferences)),
      JSON.stringify(list(payload.researchInterests)),
      JSON.stringify(list(payload.preferredMinistries)),
      JSON.stringify(list(payload.preferredPolicyAreas)),
      JSON.stringify(list(payload.preferredJurisdictions)),
      JSON.stringify(list(payload.preferredDocumentTypes)),
      JSON.stringify(list(payload.preferredSources)),
      JSON.stringify(list(payload.dashboardWidgets)),
      Boolean(payload.onboardingCompleted),
      Boolean(payload.onboardingSkipped),
      Object.prototype.hasOwnProperty.call(payload, "onboardingCompleted") ||
        Object.prototype.hasOwnProperty.call(payload, "onboardingSkipped"),
    ],
  );
  const normalized = normalizePayload({
    profile: {
      timezone: payload.timezone,
    },
    preferences: {
      preferredLanguage: payload.languagePreference,
      researchInterests: list(payload.researchInterests),
      preferredTopics: list(payload.preferredPolicyAreas),
      preferredDocumentTypes: list(payload.preferredDocumentTypes),
      preferredJurisdictions: list(payload.preferredJurisdictions),
      preferredStates: list(payload.preferredStates),
      preferredMinistries: list(payload.preferredMinistries),
      notificationPreferences: object(payload.notificationPreferences),
    },
  });
  await query(
    `INSERT INTO user_preferences (
       user_id, language, theme, timezone, notification_preferences,
       research_preferences, personalization_enabled, updated_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, TRUE, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       language = EXCLUDED.language,
       theme = EXCLUDED.theme,
       timezone = EXCLUDED.timezone,
       notification_preferences = EXCLUDED.notification_preferences,
       research_preferences = EXCLUDED.research_preferences,
       personalization_enabled = TRUE,
       updated_at = NOW()`,
    [
      userId,
      normalized.preferences.preferredLanguage,
      text(payload.themePreference, 20) || "system",
      text(payload.timezone, 80) || "Asia/Kolkata",
      JSON.stringify(object(payload.notificationPreferences)),
      JSON.stringify({
        interests: list(payload.researchInterests),
        preferredTopics: list(payload.preferredPolicyAreas),
        topics: list(payload.preferredPolicyAreas),
        documentTypes: normalized.preferences.preferredDocumentTypes,
        jurisdictions: list(payload.preferredJurisdictions),
        states: list(payload.preferredStates),
        ministries: list(payload.preferredMinistries),
      }),
    ],
  );
  await query(
    `INSERT INTO user_research_preferences (
       user_id, preferred_topics_json, preferred_jurisdictions_json,
       preferred_document_types_json, frequently_viewed_ministries_json,
       personalization_enabled, updated_at
     )
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, TRUE, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       preferred_topics_json = EXCLUDED.preferred_topics_json,
       preferred_jurisdictions_json = EXCLUDED.preferred_jurisdictions_json,
       preferred_document_types_json = EXCLUDED.preferred_document_types_json,
       frequently_viewed_ministries_json = EXCLUDED.frequently_viewed_ministries_json,
       personalization_enabled = TRUE,
       updated_at = NOW()`,
    [
      userId,
      JSON.stringify(list(payload.preferredPolicyAreas)),
      JSON.stringify([
        ...list(payload.preferredJurisdictions),
        ...list(payload.preferredStates),
      ]),
      JSON.stringify(normalized.preferences.preferredDocumentTypes),
      JSON.stringify(list(payload.preferredMinistries)),
    ],
  );
  const user = await query("SELECT * FROM users WHERE id = $1", [userId]);
  return mapProfile({ ...user.rows[0], ...result.rows[0] });
};

const changePassword = async (userId, currentPassword, nextPassword) => {
  if (String(nextPassword || "").length < 8) {
    throw new Error("New password must be at least eight characters.");
  }
  const result = await query(
    "SELECT password FROM users WHERE id = $1 LIMIT 1",
    [userId],
  );
  if (!result.rows[0]) throw new Error("User not found.");
  if (
    result.rows[0].password &&
    !(await bcrypt.compare(currentPassword || "", result.rows[0].password))
  ) {
    const error = new Error("Current password is incorrect.");
    error.status = 403;
    throw error;
  }
  const password = await bcrypt.hash(nextPassword, 12);
  await query("UPDATE users SET password = $1 WHERE id = $2", [
    password,
    userId,
  ]);
  await query(
    "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1",
    [userId],
  );
};

const addSavedContent = async (userId, payload) => {
  const itemType = String(payload.itemType || "bookmark");
  if (!["bookmark", "pinned_document", "pinned_chat"].includes(itemType)) {
    throw new Error("Unsupported saved-content type.");
  }
  const result = await query(
    `INSERT INTO saved_content (
       user_id, item_type, document_type, document_id, chat_id, title,
       metadata_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      userId,
      itemType,
      text(payload.documentType, 80),
      text(payload.documentId, 160),
      payload.chatId || null,
      text(payload.title, 500) || "Saved research",
      JSON.stringify(object(payload.metadata)),
    ],
  );
  return result.rows[0] || null;
};

const removeSavedContent = async (userId, id) => {
  const result = await query(
    "DELETE FROM saved_content WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  return Boolean(result.rows[0]);
};

const addSavedSearch = async (userId, payload) => {
  const result = await query(
    `INSERT INTO saved_searches (user_id, name, query_text, filters_json)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING *`,
    [
      userId,
      text(payload.name, 120) || "Saved search",
      text(payload.query, 500),
      JSON.stringify(object(payload.filters)),
    ],
  );
  return result.rows[0];
};

const createCollection = async (userId, payload) => {
  const result = await query(
    `INSERT INTO research_collections (user_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [
      userId,
      text(payload.name, 120) || "Untitled collection",
      text(payload.description, 1_000),
    ],
  );
  return result.rows[0];
};

const addCollectionItem = async (userId, collectionId, payload) => {
  const result = await query(
    `INSERT INTO research_collection_items (
       collection_id, document_type, document_id, title, metadata_json
     )
     SELECT $1, $2, $3, $4, $5::jsonb
     FROM research_collections
     WHERE id = $1 AND user_id = $6
     ON CONFLICT (collection_id, document_type, document_id)
     DO UPDATE SET title = EXCLUDED.title,
       metadata_json = EXCLUDED.metadata_json
     RETURNING *`,
    [
      collectionId,
      text(payload.documentType, 80),
      text(payload.documentId, 160),
      text(payload.title, 500) || "Research document",
      JSON.stringify(object(payload.metadata)),
      userId,
    ],
  );
  return result.rows[0] || null;
};

const revokeSession = async (userId, sessionId) => {
  const result = await query(
    `UPDATE user_sessions SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [sessionId, userId],
  );
  return Boolean(result.rows[0]);
};

const deleteAccount = async (userId, payload = {}) => {
  const confirmation = String(payload.confirmation || "").trim();
  if (confirmation !== "DELETE") {
    const error = new Error("Type DELETE to confirm account deletion.");
    error.status = 400;
    throw error;
  }

  await connectDB();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      `SELECT id, email, password
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId],
    );
    const user = userResult.rows[0];
    if (!user) {
      const error = new Error("User not found.");
      error.status = 404;
      throw error;
    }

    if (user.password) {
      const passwordOk = await bcrypt.compare(
        String(payload.password || ""),
        user.password,
      );
      if (!passwordOk) {
        const error = new Error("Current password is required to delete this account.");
        error.status = 403;
        throw error;
      }
    }

    const deletions = {};
    const relationExists = async (table) => {
      const result = await client.query(
        `SELECT to_regclass($1) IS NOT NULL AS exists`,
        [`public.${table}`],
      );
      return Boolean(result.rows[0]?.exists);
    };
    const deleteOwned = async (table, condition = "user_id = $1") => {
      // Some production databases no longer contain legacy, document-specific
      // chat tables. Account deletion must remain complete and idempotent across
      // schema generations instead of aborting the whole transaction on the
      // first retired relation.
      if (!(await relationExists(table))) {
        deletions[table] = 0;
        return;
      }
      const result = await client.query(
        `DELETE FROM ${table} WHERE ${condition}`,
        [userId],
      );
      deletions[table] = result.rowCount;
    };

    await deleteOwned("research_collection_items", `collection_id IN (
      SELECT id FROM research_collections WHERE user_id = $1
    )`);
    await deleteOwned("multi_document_chats");
    await deleteOwned("document_comparisons");
    await deleteOwned("document_chat_feedback");
    await deleteOwned("research_notes");
    await deleteOwned("saved_content");
    await deleteOwned("saved_searches");
    await deleteOwned("research_collections");
    await deleteOwned("saved_graph_paths");
    await deleteOwned("user_document_interactions");
    await deleteOwned("user_research_preferences");
    await deleteOwned("user_activity_events");
    await deleteOwned("user_sessions");
    await deleteOwned("document_chats");
    await deleteOwned("policy_chats");
    await deleteOwned("egazette_chats");
    await deleteOwned("act_chats");
    await deleteOwned("bill_chats");
    await deleteOwned("user_profiles");
    await deleteOwned("research_chats");
    await deleteOwned("user_preferences");
    await client.query(
      `UPDATE recommendations
       SET user_id = NULL
       WHERE user_id = $1`,
      [userId],
    );
    await client.query(
      `UPDATE document_processing_jobs
       SET requested_by = NULL
       WHERE requested_by = $1`,
      [userId],
    );
    await client.query(
      `UPDATE feedback_submissions
       SET user_id = NULL
       WHERE user_id = $1`,
      [userId],
    );
    await client.query(
      `UPDATE bug_reports
       SET user_id = NULL
       WHERE user_id = $1`,
      [userId],
    );
    await client.query(
      `UPDATE audit_logs
       SET user_id = NULL
       WHERE user_id = $1`,
      [userId],
    );

    const deleted = await client.query(
      `DELETE FROM users
       WHERE id = $1
       RETURNING id, email`,
      [userId],
    );
    await client.query("COMMIT");
    return {
      deleted: Boolean(deleted.rows[0]),
      userId: String(userId),
      email: user.email,
      deletions,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  addCollectionItem,
  addSavedContent,
  addSavedSearch,
  changePassword,
  createCollection,
  deleteAccount,
  getAccountData,
  removeSavedContent,
  revokeSession,
  sanitizeList: list,
  sanitizeObject: object,
  sanitizeText: text,
  updateProfile,
};
