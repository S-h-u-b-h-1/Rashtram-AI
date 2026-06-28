const { normalizeRecord } = require("../core/normalizer");

const attachConnectorLifecycle = (connector, collections = []) => {
  const configuredCollections =
    collections.length > 0
      ? collections
      : [connector.defaultCollection].filter(Boolean);

  connector.sourceName = connector.sourceName || connector.name;
  connector.collections = configuredCollections;
  connector.discover =
    connector.discover ||
    ((options = {}, context) =>
      connector.collect({ ...options, catalogOnly: true }, context));
  connector.fetchDetails =
    connector.fetchDetails ||
    (async (record) => record);
  connector.normalize =
    connector.normalize ||
    ((record) => normalizeRecord(record));
  connector.run =
    connector.run ||
    ((options = {}, context) => connector.collect(options, context));
  connector.healthCheck =
    connector.healthCheck ||
    (async (options = {}, dependencies = {}) => {
      const { probeConnector } = require("../core/healthCheck");
      return probeConnector(connector, options, dependencies);
    });
  return connector;
};

module.exports = { attachConnectorLifecycle };
