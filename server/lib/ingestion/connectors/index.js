const { digitalSansadConnector } = require("./digitalSansadConnector");
const { eGazetteConnector } = require("./eGazetteConnector");
const { indiaCodeConnector } = require("./indiaCodeConnector");
const { lokSabhaConnector } = require("./lokSabhaConnector");
const { ministryConnector } = require("./ministryConnector");
const { prsConnector } = require("./prsConnector");
const { rajyaSabhaConnector } = require("./rajyaSabhaConnector");
const { stateGazetteConnector } = require("./stateGazetteConnector");
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
];

const CONNECTOR_ALIASES = {
  ministries: "ministry",
  "state-legislatures": "state-legislature",
  "state-gazettes": "state-gazette",
  indiacode: "india-code",
};

const connectorByName = (name) =>
  CONNECTORS.find(
    (connector) =>
      connector.name === (CONNECTOR_ALIASES[name] || name),
  );

module.exports = {
  CONNECTOR_ALIASES,
  CONNECTORS,
  connectorByName,
};
