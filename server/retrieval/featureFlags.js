const crypto = require("node:crypto");

const FLAG_DEFINITIONS = Object.freeze({
  queryPlanner: "RESEARCH_QUERY_PLANNER",
  rrf: "RESEARCH_RRF",
  authorityWeighting: "RESEARCH_AUTHORITY_WEIGHTING",
  reranker: "RESEARCH_RERANKER",
  evidenceSufficiency: "RESEARCH_EVIDENCE_SUFFICIENCY",
  citationVerifier: "RESEARCH_CITATION_VERIFIER",
  knowledgeAssistedRetrieval: "RESEARCH_KNOWLEDGE_ASSISTED",
  caching: "RESEARCH_VERSIONED_CACHE",
});

const enabledValue = (value, fallback = true) => {
  if (value == null || String(value).trim() === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
};

const percentage = (value, fallback = 100) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
};

const bucket = (flag, actorId) => {
  const digest = crypto.createHash("sha256").update(`${flag}:${actorId || "anonymous"}`).digest();
  return digest.readUInt32BE(0) % 100;
};

const resolveResearchFlags = ({ actorId = "anonymous", env = process.env } = {}) => {
  const globalRollout = percentage(env.RESEARCH_V3_ROLLOUT_PERCENT, 100);
  const flags = Object.fromEntries(Object.entries(FLAG_DEFINITIONS).map(([name, prefix]) => {
    const enabled = enabledValue(env[`${prefix}_ENABLED`], true);
    const rollout = percentage(env[`${prefix}_ROLLOUT_PERCENT`], globalRollout);
    return [name, enabled && bucket(name, actorId) < rollout];
  }));
  return {
    version: "research-rollout-v1",
    globalRolloutPercent: globalRollout,
    legacyPathAvailable: true,
    ...flags,
  };
};

const applyResearchFlags = (plan, flags) => {
  if (!flags.queryPlanner) {
    return {
      queryType: plan.queryType,
      useMetadata: true,
      useLexical: true,
      useVector: true,
      useGraph: false,
      comparisonIsolation: plan.comparisonIsolation,
      plannerVersion: "legacy-hybrid-planner-v1",
    };
  }
  return {
    ...plan,
    useGraph: flags.knowledgeAssistedRetrieval ? plan.useGraph : false,
  };
};

const rolloutConfiguration = (env = process.env) => ({
  version: "research-rollout-v1",
  globalRolloutPercent: percentage(env.RESEARCH_V3_ROLLOUT_PERCENT, 100),
  flags: Object.fromEntries(Object.entries(FLAG_DEFINITIONS).map(([name, prefix]) => [name, {
    enabled: enabledValue(env[`${prefix}_ENABLED`], true),
    rolloutPercent: percentage(
      env[`${prefix}_ROLLOUT_PERCENT`],
      percentage(env.RESEARCH_V3_ROLLOUT_PERCENT, 100),
    ),
  }])),
});

module.exports = {
  FLAG_DEFINITIONS,
  applyResearchFlags,
  resolveResearchFlags,
  rolloutConfiguration,
};
