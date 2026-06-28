const {
  createOfficialDirectoryConnector,
} = require("./officialDirectoryConnector");
const { attachConnectorLifecycle } = require("./connectorLifecycle");

const STATE_LEGISLATURE_SOURCES = {
  delhi: "https://delhiassembly.delhi.gov.in/",
  karnataka: "https://kla.kar.nic.in/",
  kerala: "https://niyamasabha.nic.in/",
  maharashtra: "https://mls.org.in/",
  rajasthan: "https://assembly.rajasthan.gov.in/",
  tamil_nadu: "https://www.assembly.tn.gov.in/",
};

const stateLegislatureConnector = {
  name: "state-legislature",
  defaultCollection: "delhi",
  async collect(options = {}, context) {
    const requested = String(
      options.collection || options.collections || this.defaultCollection,
    )
      .split(",")
      .map((value) => value.trim());
    const jurisdictions = requested.includes("all")
      ? Object.keys(STATE_LEGISLATURE_SOURCES)
      : requested;
    const combined = {
      records: [],
      snapshots: [],
      errors: [],
      diagnostics: [],
    };
    for (const jurisdiction of jurisdictions) {
      const url =
        jurisdictions.length === 1 && options.url
          ? options.url
          : STATE_LEGISLATURE_SOURCES[jurisdiction];
      if (!url) {
        throw new Error(
          `Unknown state legislature "${jurisdiction}". Pass --url for an official state portal.`,
        );
      }
      const label = jurisdiction
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
      try {
        const result = await createOfficialDirectoryConnector({
          name: this.name,
          collection: jurisdiction,
          url,
          authority: `${label} Legislature`,
          jurisdictionLevel: "state",
          jurisdiction: label,
          blockedWhenEmpty: true,
          blockedReason:
            "The official state portal was reachable but exposed no crawlable legislative PDF links on its landing page.",
        }).collect({ ...options, url }, context);
        combined.records.push(...result.records);
        combined.snapshots.push(...result.snapshots);
        combined.errors.push(...result.errors);
        combined.diagnostics.push(...(result.diagnostics || []));
      } catch (error) {
        combined.errors.push({
          stage: "state-portal",
          collection: jurisdiction,
          message: error.message,
        });
      }
    }
    combined.records = combined.records.slice(
      0,
      Number(options.limit || combined.records.length),
    );
    return combined;
  },
};

attachConnectorLifecycle(
  stateLegislatureConnector,
  Object.keys(STATE_LEGISLATURE_SOURCES),
);

module.exports = {
  STATE_LEGISLATURE_SOURCES,
  stateLegislatureConnector,
};
