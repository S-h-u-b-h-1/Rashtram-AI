const { digitalSansadConnector } = require("./digitalSansadConnector");
const { eGazetteConnector } = require("./eGazetteConnector");
const { indiaCodeConnector } = require("./indiaCodeConnector");
const { lokSabhaConnector } = require("./lokSabhaConnector");
const { ministryConnector } = require("./ministryConnector");
const {
  myGovConnector,
  ndapConnector,
  nitiAayogConnector,
  ogdConnector,
  pibConnector,
} = require("./nationalPolicyConnectors");
const { prsConnector } = require("./prsConnector");
const { rajyaSabhaConnector } = require("./rajyaSabhaConnector");
const { stateGazetteConnector } = require("./stateGazetteConnector");
const {
  regulatorConnectors,
} = require("./regulatorConnectors");
const {
  stateDirectoryConnector,
} = require("./stateDirectoryConnector");
const {
  stateLegislatureConnector,
} = require("./stateLegislatureConnector");

const CONNECTORS = [
  prsConnector,
  indiaCodeConnector,
  eGazetteConnector,
  digitalSansadConnector,
  lokSabhaConnector,
  rajyaSabhaConnector,
  stateLegislatureConnector,
  stateGazetteConnector,
  ministryConnector,
  stateDirectoryConnector,
  nitiAayogConnector,
  pibConnector,
  myGovConnector,
  ndapConnector,
  ogdConnector,
  ...regulatorConnectors,
];

const CONNECTOR_ALIASES = {
  ministries: "ministry",
  states: "state-directory",
  "state-legislatures": "state-legislature",
  "state-gazettes": "state-gazette",
  indiacode: "india-code",
  prs: "prs-india",
};

const SOURCE_GROUPS = {
  directories: ["ministry", "state-directory"],
  policies: ["niti-aayog", "pib", "mygov", "ndap", "ogd-india"],
  regulators: regulatorConnectors.map((connector) => connector.name),
  national: [
    "prs-india",
    "india-code",
    "egazette",
    "digital-sansad",
    "lok-sabha",
    "rajya-sabha",
    "niti-aayog",
    "pib",
    "mygov",
    "ndap",
    "ogd-india",
  ],
};

const connectorByName = (name) =>
  CONNECTORS.find(
    (connector) =>
      connector.name === (CONNECTOR_ALIASES[name] || name),
  );

module.exports = {
  CONNECTOR_ALIASES,
  CONNECTORS,
  SOURCE_GROUPS,
  connectorByName,
};
