const test = require("node:test");
const assert = require("node:assert/strict");

const migrations = require("../migrations");
const {
  DOCUMENT_TYPES,
  LANGUAGES,
  PRIMARY_USES,
  ROLE_VALUES,
  normalizePayload,
} = require("../onboarding/onboardingService");

test("onboarding migration is registered after profile onboarding", () => {
  assert.equal(
    migrations.some(
      (entry) => entry.name === "011_profile_role_and_preference_sync.js",
    ),
    true,
  );
});

test("onboarding payload normalization preserves useful profile and preference data", () => {
  const normalized = normalizePayload({
    profile: {
      name: "  Rashtram User  ",
      organization: " Rishihood University ",
      role: "Policy Professional",
      designation: " Research Associate ",
      location: " Delhi ",
      timezone: " Asia/Kolkata ",
    },
    preferences: {
      preferredLanguage: "Bilingual",
      primaryUse: "Legal Research",
      researchInterests: ["Finance", "Finance", "", "Environment"],
      preferredTopics: ["Tax", "Education"],
      preferredDocumentTypes: ["Bills", "bill", "act", "unknown"],
      preferredJurisdictions: ["Union", "State"],
      preferredStates: ["Delhi", "Delhi", "Maharashtra"],
      preferredMinistries: ["Finance", "Education"],
      industries: ["Legal", "Policy"],
      researchDescription: " Track constitutional and fiscal policy changes. ",
      notificationPreferences: { emailDigest: true },
    },
  });

  assert.equal(normalized.profile.name, "Rashtram User");
  assert.equal(normalized.profile.organization, "Rishihood University");
  assert.equal(normalized.profile.role, "policy_professional");
  assert.equal(normalized.profile.designation, "Research Associate");
  assert.equal(normalized.profile.location, "Delhi");
  assert.equal(normalized.profile.timezone, "Asia/Kolkata");
  assert.equal(normalized.preferences.preferredLanguage, "bilingual");
  assert.equal(normalized.preferences.primaryUse, "legal_research");
  assert.deepEqual(normalized.preferences.researchInterests, [
    "Finance",
    "Environment",
  ]);
  assert.deepEqual(normalized.preferences.preferredDocumentTypes, [
    "bill",
    "act",
  ]);
  assert.deepEqual(normalized.preferences.preferredStates, [
    "Delhi",
    "Maharashtra",
  ]);
  assert.deepEqual(normalized.preferences.notificationPreferences, {
    emailDigest: true,
  });
});

test("onboarding enum sets include the product-supported account options", () => {
  assert.equal(ROLE_VALUES.has("chartered_accountant"), true);
  assert.equal(ROLE_VALUES.has("company_secretary"), true);
  assert.equal(PRIMARY_USES.has("compliance_monitoring"), true);
  assert.equal(DOCUMENT_TYPES.has("state_bill"), true);
  assert.equal(LANGUAGES.has("hindi"), true);
  assert.equal(LANGUAGES.has("bilingual"), true);
});
