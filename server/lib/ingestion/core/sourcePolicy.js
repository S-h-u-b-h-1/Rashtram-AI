const SOURCE_AUTHORITY_CLASSES = Object.freeze({
  OFFICIAL_PRIMARY: "OFFICIAL_PRIMARY",
  OFFICIAL_REGULATORY: "OFFICIAL_REGULATORY",
  OFFICIAL_GOVERNMENT: "OFFICIAL_GOVERNMENT",
  OFFICIAL_LEGISLATURE: "OFFICIAL_LEGISLATURE",
  GOVERNMENT_POLICY: "GOVERNMENT_POLICY",
  INSTITUTIONAL_SECONDARY: "INSTITUTIONAL_SECONDARY",
  ACADEMIC_RESEARCH: "ACADEMIC_RESEARCH",
  TRUSTED_SECONDARY: "TRUSTED_SECONDARY",
  GENERIC_WEB: "GENERIC_WEB",
  UNKNOWN: "UNKNOWN",
});

const SOURCE_POLICIES = Object.freeze({
  "prs-india": { priority: "P1", cadence: "daily", cadenceHours: 24, authorityClass: "TRUSTED_SECONDARY", publicLabel: "Institutional research" },
  "india-code": { priority: "P0", cadence: "daily", cadenceHours: 24, authorityClass: "OFFICIAL_PRIMARY", publicLabel: "Official government source" },
  egazette: { priority: "P0", cadence: "daily", cadenceHours: 24, authorityClass: "OFFICIAL_PRIMARY", publicLabel: "Official government source" },
  "digital-sansad": { priority: "P0", cadence: "daily", cadenceHours: 24, authorityClass: "OFFICIAL_LEGISLATURE", publicLabel: "Official legislature source" },
  "lok-sabha": { priority: "P0", cadence: "daily", cadenceHours: 24, authorityClass: "OFFICIAL_LEGISLATURE", publicLabel: "Official legislature source" },
  "rajya-sabha": { priority: "P0", cadence: "daily", cadenceHours: 24, authorityClass: "OFFICIAL_LEGISLATURE", publicLabel: "Official legislature source" },
  "state-legislature": { priority: "P0", cadence: "weekly", cadenceHours: 168, authorityClass: "OFFICIAL_LEGISLATURE", publicLabel: "Official legislature source" },
  "state-gazette": { priority: "P0", cadence: "weekly", cadenceHours: 168, authorityClass: "OFFICIAL_PRIMARY", publicLabel: "Official government source" },
  "state-policy": { priority: "P2", cadence: "weekly", cadenceHours: 168, authorityClass: "GOVERNMENT_POLICY", publicLabel: "Government policy source" },
  ministry: { priority: "P2", cadence: "weekly", cadenceHours: 168, authorityClass: "OFFICIAL_GOVERNMENT", publicLabel: "Official government source" },
  "ministry-environment": { priority: "P2", cadence: "daily", cadenceHours: 24, authorityClass: "GOVERNMENT_POLICY", publicLabel: "Government policy source" },
  "india-gov": { priority: "P2", cadence: "weekly", cadenceHours: 168, authorityClass: "OFFICIAL_GOVERNMENT", publicLabel: "Official government source" },
  "policy-edge": { priority: "P2", cadence: "weekly", cadenceHours: 168, authorityClass: "TRUSTED_SECONDARY", publicLabel: "Institutional research" },
  "state-directory": { priority: "P2", cadence: "weekly", cadenceHours: 168, authorityClass: "OFFICIAL_GOVERNMENT", publicLabel: "Official government source" },
  "niti-aayog": { priority: "P2", cadence: "daily", cadenceHours: 24, authorityClass: "GOVERNMENT_POLICY", publicLabel: "Government policy source" },
  pib: { priority: "P1", cadence: "3-hourly", cadenceHours: 3, authorityClass: "OFFICIAL_GOVERNMENT", publicLabel: "Official government source" },
  mygov: { priority: "P2", cadence: "daily", cadenceHours: 24, authorityClass: "GOVERNMENT_POLICY", publicLabel: "Government policy source" },
  ndap: { priority: "P2", cadence: "weekly", cadenceHours: 168, authorityClass: "OFFICIAL_GOVERNMENT", publicLabel: "Official government source" },
  "ogd-india": { priority: "P2", cadence: "weekly", cadenceHours: 168, authorityClass: "OFFICIAL_GOVERNMENT", publicLabel: "Official government source" },
});

const P1_REGULATORS = new Set([
  "regulator-rbi",
  "regulator-sebi",
  "regulator-nmc",
  "regulator-cbic",
  "regulator-uidai",
]);

const sourcePolicyFor = (sourceName, fallback = {}) => {
  const rawName = String(sourceName || "").trim().toLowerCase();
  const name = ({
    policyedge: "policy-edge",
    prs: "prs-india",
    indiacode: "india-code",
  })[rawName] || rawName;
  const configured = SOURCE_POLICIES[name];
  if (configured) return { sourceName: name, ...configured };
  if (name.startsWith("regulator-")) {
    const priority = P1_REGULATORS.has(name) ? "P1" : "P2";
    return {
      sourceName: name,
      priority,
      cadence: String(fallback.cadence || (priority === "P1" ? "daily" : "weekly")),
      cadenceHours: Number(fallback.cadenceHours || (priority === "P1" ? 24 : 168)),
      authorityClass: SOURCE_AUTHORITY_CLASSES.OFFICIAL_REGULATORY,
      publicLabel: "Regulatory source",
    };
  }
  return {
    sourceName: name,
    priority: "P2",
    cadence: String(fallback.cadence || fallback.ingestionFrequency || "manual"),
    cadenceHours: Number(fallback.cadenceHours || 720),
    authorityClass: SOURCE_AUTHORITY_CLASSES.UNKNOWN,
    publicLabel: "External web source",
  };
};

module.exports = {
  SOURCE_AUTHORITY_CLASSES,
  SOURCE_POLICIES,
  sourcePolicyFor,
};
