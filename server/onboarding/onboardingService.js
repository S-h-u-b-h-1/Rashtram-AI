const { connectDB, getPool, query } = require("../db");

const ROLE_VALUES = new Set([
  "student",
  "researcher",
  "policy_professional",
  "lawyer",
  "chartered_accountant",
  "company_secretary",
  "business_owner",
  "compliance_professional",
  "journalist",
  "government_professional",
  "faculty",
  "other",
]);

const DOCUMENT_TYPES = new Set([
  "bill",
  "state_bill",
  "act",
  "policy",
  "gazette",
  "rule",
  "circular",
  "report",
]);

const PRIMARY_USES = new Set([
  "academic_research",
  "legal_research",
  "compliance_monitoring",
  "business_policy_intelligence",
  "civil_services_preparation",
  "journalism",
  "government_research",
  "other",
]);

const LANGUAGES = new Set(["english", "hindi", "bilingual"]);
const ONBOARDING_REQUIRED_SINCE = new Date("2026-07-12T00:00:00.000Z");

const text = (value, max = 500) => {
  const normalized = String(value ?? "").normalize("NFKC").trim();
  return normalized ? normalized.slice(0, max) : null;
};

const slug = (value, max = 80) =>
  text(value, max)
    ?.toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || null;

const list = (value, { maxItems = 30, itemMax = 120, allowed = null } = {}) => {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  for (const item of value) {
    const prepared = allowed ? slug(item, itemMax) : text(item, itemMax);
    if (!prepared) continue;
    if (allowed && !allowed.has(prepared)) continue;
    if (!normalized.includes(prepared)) normalized.push(prepared);
    if (normalized.length >= maxItems) break;
  }
  return normalized;
};

const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const toCamelProfile = (row = {}) => ({
  organization: row.organization || null,
  designation: row.designation || null,
  role: row.role || null,
  bio: row.bio || null,
  location: row.location || null,
  timezone: row.timezone || "Asia/Kolkata",
});

const parseResearchPreferences = (row = {}) => {
  const research = row.research_preferences || {};
  return {
    preferredLanguage: String(row.language || "english").toLowerCase(),
    researchInterests: research.interests || [],
    preferredTopics: research.preferredTopics || research.topics || research.policyAreas || [],
    preferredDocumentTypes: research.documentTypes || [],
    preferredJurisdictions: research.jurisdictions || [],
    preferredStates: research.states || [],
    preferredMinistries: research.ministries || [],
    primaryUse: research.primaryUse || null,
    industries: research.industries || [],
    researchDescription: research.researchDescription || null,
    notificationPreferences: row.notification_preferences || {},
  };
};

const mapAuthState = (row) => {
  if (!row) return null;
  const createdAt = row.created_at;
  const profileExists = Boolean(row.profile_user_id);
  const completed = Boolean(row.onboarding_completed);
  const skipped = Boolean(row.onboarding_skipped);
  const legacyUser =
    !profileExists && createdAt && new Date(createdAt) < ONBOARDING_REQUIRED_SINCE;
  const required = !legacyUser && !completed && !skipped;
  return {
    user: {
      id: String(row.id),
      name: row.name,
      email: row.email,
      avatar: row.avatar || null,
      authProvider: row.google_id ? "google" : "password",
      createdAt,
    },
    profile: toCamelProfile(row),
    preferences: parseResearchPreferences(row),
    onboarding: {
      completed,
      skipped,
      completedAt: row.onboarding_completed_at || null,
      required,
      legacyUser,
    },
  };
};

const getAuthState = async (userId, execute = query) => {
  const result = await execute(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.avatar,
       u.google_id,
       u.created_at,
       p.user_id AS profile_user_id,
       p.organization,
       p.designation,
       p.role,
       p.bio,
       p.location,
       p.timezone,
       p.onboarding_completed,
       p.onboarding_skipped,
       p.onboarding_completed_at,
       up.language,
       up.notification_preferences,
       up.research_preferences
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     LEFT JOIN user_preferences up ON up.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId],
  );
  return mapAuthState(result.rows[0]);
};

const ensureDefaultAccountState = async (userId, execute = query) => {
  await execute(
    `INSERT INTO user_profiles (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  await execute(
    `INSERT INTO user_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  await execute(
    `INSERT INTO user_research_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
};

const normalizePayload = (payload = {}) => {
  const profile = object(payload.profile);
  const preferences = object(payload.preferences);
  const role = slug(profile.role, 80);
  const primaryUse = slug(preferences.primaryUse, 80);
  return {
    profile: {
      name: text(profile.name, 120),
      organization: text(profile.organization, 160),
      role: role && ROLE_VALUES.has(role) ? role : role || null,
      designation: text(profile.designation, 160),
      bio: text(profile.bio, 1_500),
      location: text(profile.location, 160),
      timezone: text(profile.timezone, 80) || "Asia/Kolkata",
    },
    preferences: {
      preferredLanguage:
        LANGUAGES.has(slug(preferences.preferredLanguage, 40))
          ? slug(preferences.preferredLanguage, 40)
          : "english",
      researchInterests: list(preferences.researchInterests, { maxItems: 20 }),
      preferredTopics: list(preferences.preferredTopics, { maxItems: 30 }),
      preferredDocumentTypes: list(preferences.preferredDocumentTypes, {
        maxItems: 12,
        allowed: DOCUMENT_TYPES,
      }),
      preferredJurisdictions: list(preferences.preferredJurisdictions, {
        maxItems: 40,
      }),
      preferredStates: list(preferences.preferredStates, { maxItems: 40 }),
      preferredMinistries: list(preferences.preferredMinistries, {
        maxItems: 30,
      }),
      primaryUse:
        primaryUse && PRIMARY_USES.has(primaryUse) ? primaryUse : primaryUse || null,
      industries: list(preferences.industries, { maxItems: 20 }),
      researchDescription: text(preferences.researchDescription, 800),
      notificationPreferences: object(preferences.notificationPreferences),
    },
  };
};

const saveOnboarding = async (
  userId,
  payload = {},
  { complete = false, skipped = false } = {},
) => {
  const normalized = normalizePayload(payload);
  await connectDB();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await ensureDefaultAccountState(userId, client.query.bind(client));
    if (normalized.profile.name) {
      await client.query(
        `UPDATE users
         SET name = $2
         WHERE id = $1`,
        [userId, normalized.profile.name],
      );
    }
    await client.query(
      `INSERT INTO user_profiles (
         user_id, organization, role, designation, bio, location, timezone,
         language_preference, notification_preferences, research_interests,
         preferred_ministries, preferred_policy_areas, preferred_jurisdictions,
         preferred_document_types, onboarding_completed, onboarding_skipped,
         onboarding_completed_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb,
         $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16,
         CASE WHEN $15 THEN NOW() ELSE NULL END, NOW()
       )
       ON CONFLICT (user_id) DO UPDATE SET
         organization = EXCLUDED.organization,
         role = EXCLUDED.role,
         designation = EXCLUDED.designation,
         bio = EXCLUDED.bio,
         location = EXCLUDED.location,
         timezone = EXCLUDED.timezone,
         language_preference = EXCLUDED.language_preference,
         notification_preferences = EXCLUDED.notification_preferences,
         research_interests = EXCLUDED.research_interests,
         preferred_ministries = EXCLUDED.preferred_ministries,
         preferred_policy_areas = EXCLUDED.preferred_policy_areas,
         preferred_jurisdictions = EXCLUDED.preferred_jurisdictions,
         preferred_document_types = EXCLUDED.preferred_document_types,
         onboarding_completed = EXCLUDED.onboarding_completed,
         onboarding_skipped = EXCLUDED.onboarding_skipped,
         onboarding_completed_at = CASE
           WHEN EXCLUDED.onboarding_completed THEN NOW()
           ELSE NULL
         END,
         updated_at = NOW()`,
      [
        userId,
        skipped ? null : normalized.profile.organization,
        skipped ? null : normalized.profile.role,
        skipped ? null : normalized.profile.designation,
        skipped ? null : normalized.profile.bio,
        skipped ? null : normalized.profile.location,
        normalized.profile.timezone,
        normalized.preferences.preferredLanguage,
        JSON.stringify(normalized.preferences.notificationPreferences),
        JSON.stringify(skipped ? [] : normalized.preferences.researchInterests),
        JSON.stringify(skipped ? [] : normalized.preferences.preferredMinistries),
        JSON.stringify(skipped ? [] : normalized.preferences.preferredTopics),
        JSON.stringify(
          skipped
            ? []
            : [
                ...normalized.preferences.preferredJurisdictions,
                ...normalized.preferences.preferredStates,
              ],
        ),
        JSON.stringify(skipped ? [] : normalized.preferences.preferredDocumentTypes),
        Boolean(complete && !skipped),
        Boolean(skipped),
      ],
    );
    const researchPreferences = skipped
      ? {}
      : {
          interests: normalized.preferences.researchInterests,
          preferredTopics: normalized.preferences.preferredTopics,
          topics: normalized.preferences.preferredTopics,
          documentTypes: normalized.preferences.preferredDocumentTypes,
          jurisdictions: normalized.preferences.preferredJurisdictions,
          states: normalized.preferences.preferredStates,
          ministries: normalized.preferences.preferredMinistries,
          primaryUse: normalized.preferences.primaryUse,
          industries: normalized.preferences.industries,
          researchDescription: normalized.preferences.researchDescription,
        };
    await client.query(
      `INSERT INTO user_preferences (
         user_id, language, timezone, notification_preferences,
         research_preferences, personalization_enabled, updated_at
       )
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         language = EXCLUDED.language,
         timezone = EXCLUDED.timezone,
         notification_preferences = EXCLUDED.notification_preferences,
         research_preferences = EXCLUDED.research_preferences,
         personalization_enabled = EXCLUDED.personalization_enabled,
         updated_at = NOW()`,
      [
        userId,
        normalized.preferences.preferredLanguage,
        normalized.profile.timezone,
        JSON.stringify(normalized.preferences.notificationPreferences),
        JSON.stringify(researchPreferences),
        Boolean(!skipped),
      ],
    );
    await client.query(
      `INSERT INTO user_research_preferences (
         user_id, preferred_topics_json, preferred_jurisdictions_json,
         preferred_document_types_json, frequently_viewed_ministries_json,
         personalization_enabled, updated_at
       )
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         preferred_topics_json = EXCLUDED.preferred_topics_json,
         preferred_jurisdictions_json = EXCLUDED.preferred_jurisdictions_json,
         preferred_document_types_json = EXCLUDED.preferred_document_types_json,
         frequently_viewed_ministries_json = EXCLUDED.frequently_viewed_ministries_json,
         personalization_enabled = EXCLUDED.personalization_enabled,
         updated_at = NOW()`,
      [
        userId,
        JSON.stringify(skipped ? [] : normalized.preferences.preferredTopics),
        JSON.stringify(
          skipped
            ? []
            : [
                ...normalized.preferences.preferredJurisdictions,
                ...normalized.preferences.preferredStates,
              ],
        ),
        JSON.stringify(skipped ? [] : normalized.preferences.preferredDocumentTypes),
        JSON.stringify(skipped ? [] : normalized.preferences.preferredMinistries),
        Boolean(!skipped),
      ],
    );
    const state = await getAuthState(userId, client.query.bind(client));
    await client.query("COMMIT");
    return state;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  DOCUMENT_TYPES,
  LANGUAGES,
  PRIMARY_USES,
  ROLE_VALUES,
  ensureDefaultAccountState,
  getAuthState,
  normalizePayload,
  saveOnboarding,
};
