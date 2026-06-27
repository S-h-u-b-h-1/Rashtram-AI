const {
  createOfficialDirectoryConnector,
} = require("./officialDirectoryConnector");

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
    const jurisdiction = options.collection || this.defaultCollection;
    const url = options.url || STATE_LEGISLATURE_SOURCES[jurisdiction];
    if (!url) {
      throw new Error(
        `Unknown state legislature "${jurisdiction}". Pass --url for an official state portal.`,
      );
    }
    return createOfficialDirectoryConnector({
      name: this.name,
      collection: jurisdiction,
      url,
      authority: `${jurisdiction.replace(/_/g, " ")} Legislature`,
      jurisdictionLevel: "state",
      jurisdiction: jurisdiction.replace(/_/g, " "),
    }).collect(options, context);
  },
};

module.exports = {
  STATE_LEGISLATURE_SOURCES,
  stateLegislatureConnector,
};
