const { query } = require("../../../db");
const { PoliteFetcher } = require("./fetcher");

const PRODUCTION_CONNECTORS = new Set([
  "prs-india",
  "india-code",
  "egazette",
  "digital-sansad",
  "lok-sabha",
  "rajya-sabha",
  "ministry",
  "state-legislature",
  "state-gazette",
  "state-directory",
  "niti-aayog",
  "pib",
  "mygov",
  "ndap",
  "ogd-india",
  "ministry-environment",
  "india-gov",
  "state-policy",
  "policy-edge",
  "regulator-rbi",
  "regulator-sebi",
  "regulator-trai",
  "regulator-uidai",
  "regulator-cci",
  "regulator-cerc",
  "regulator-irdai",
  "regulator-pfrda",
  "regulator-nmc",
  "regulator-aicte",
  "regulator-ugc",
  "regulator-ec",
  "regulator-nclt",
  "regulator-nclat",
  "regulator-gst-council",
  "regulator-cbdt",
  "regulator-cbic",
]);

const countPdfLinks = (records) =>
  new Set(
    records.flatMap((record) => [
      record.pdfUrl,
      ...(record.resources || [])
        .filter(
          (resource) =>
            resource.resourceType === "pdf" ||
            /\.pdf(?:$|[?#])/i.test(resource.url || ""),
        )
        .map((resource) => resource.url),
    ]),
  ).size;

const validateCollectionShape = (collection) => {
  if (
    !collection ||
    !Array.isArray(collection.records) ||
    !Array.isArray(collection.snapshots) ||
    !Array.isArray(collection.errors) ||
    (collection.directoryEntries != null &&
      !Array.isArray(collection.directoryEntries))
  ) {
    return {
      valid: false,
      reason: "Connector response must contain records, snapshots, and errors arrays.",
    };
  }

  const malformedRecords = collection.records.filter(
    (record) =>
      !record.title ||
      !record.sourceName ||
      !(record.sourceRecordId || record.sourceDocumentId) ||
      !(record.sourceUrl || record.detailUrl || record.pdfUrl),
  ).length;
  return malformedRecords
    ? {
        valid: false,
        reason: `${malformedRecords} sample record(s) do not match the universal source shape.`,
      }
    : { valid: true, reason: null };
};

const displayStatusFor = (status, history = {}) => {
  if (status === "blocked") return "Blocked";
  if (["unavailable", "parser changed", "degraded"].includes(status)) {
    return "Degraded";
  }
  if (status === "planned") return "Not Run";
  if (!history.lastSuccessfulAt) return "Connected";
  const ageDays =
    (Date.now() - new Date(history.lastSuccessfulAt).getTime()) / 86_400_000;
  return ageDays <= 7 ? "Fresh" : "Stale";
};

const probeConnector = async (
  connector,
  options = {},
  dependencies = {},
) => {
  const startedAt = Date.now();
  const fetcher =
    dependencies.fetcher ||
    new PoliteFetcher({
      delayMs: options.delayMs ?? 750,
      timeoutMs: options.timeoutMs ?? 20_000,
      retries: options.retries ?? 2,
    });
  const history = dependencies.history || {};

  try {
    const collection = await connector.collect(
      {
        ...options,
        catalogOnly: true,
        detailConcurrency: 1,
        limit: Number(options.limit || 3),
        maxPages: Number(options.maxPages || 1),
      },
      { fetcher },
    );
    const shape = validateCollectionShape(collection);
    const discovered = collection.records?.length || 0;
    const directoryEntries = collection.directoryEntries?.length || 0;
    const pdfLinks = shape.valid ? countPdfLinks(collection.records) : 0;
    const errorCount =
      (collection.errors?.length || 0) + Number(history.errorCount || 0);
    const reachable =
      (collection.snapshots?.length || 0) > 0 ||
      discovered > 0 ||
      directoryEntries > 0;
    const blockedDiagnostic = collection.diagnostics?.find(
      (diagnostic) => diagnostic.type === "blocked",
    );
    const blockedError = collection.errors?.find((error) =>
      /robots|captcha|forbidden|status code 403|\b403\b/i.test(
        String(error.message || error.error || ""),
      ),
    );
    let status = "connected";

    if (!shape.valid) status = "parser changed";
    else if (blockedDiagnostic || blockedError) status = "blocked";
    else if (!reachable && collection.errors.length) status = "unavailable";
    else if (
      (discovered > 0 || directoryEntries > 0) &&
      collection.errors.length
    ) {
      status = "degraded";
    }
    else if (
      discovered === 0 &&
      directoryEntries === 0 &&
      collection.diagnostics?.some(
        (diagnostic) => diagnostic.type === "empty-source",
      )
    ) {
      status = "no data found";
    } else if (
      discovered === 0 &&
      directoryEntries === 0 &&
      PRODUCTION_CONNECTORS.has(connector.name)
    ) {
      status = "parser changed";
    } else if (
      discovered === 0 &&
      directoryEntries === 0 &&
      !history.documentCount &&
      !history.latestRunStatus
    ) {
      status = "not run";
    } else if (discovered === 0 && directoryEntries === 0) {
      status = "no data found";
    }

    return {
      source: connector.name,
      status,
      displayStatus: displayStatusFor(status, history),
      reachable,
      parserShapeValid: shape.valid,
      parserStatus: shape.valid ? "Valid" : "Changed",
      parserMessage: shape.reason,
      sampleRecordsDiscovered: discovered,
      sampleDirectoryEntriesDiscovered: directoryEntries,
      samplePdfLinksDiscovered: pdfLinks,
      pdfDiscoveryStatus: pdfLinks > 0 ? "Discovered" : "Not Discovered",
      snapshotsCaptured: collection.snapshots?.length || 0,
      latestIngestionStatus: history.latestRunStatus || null,
      lastSuccessfulIngestion: history.lastSuccessfulAt || null,
      storedSourceRecords: Number(history.documentCount || 0),
      refreshAgeHours: history.lastSuccessfulAt
        ? Math.round(
            ((Date.now() - new Date(history.lastSuccessfulAt).getTime()) /
              3_600_000) *
              10,
          ) / 10
        : null,
      latestStoredError: history.latestError || null,
      errorCount,
      durationMs: Date.now() - startedAt,
      error:
        status === "blocked"
          ? String(
              blockedDiagnostic?.message ||
                blockedError?.message ||
                blockedError?.error ||
                "The official source rejected automated catalogue access.",
            ).slice(0, 300)
          : status === "unavailable"
          ? String(
              collection.errors[0]?.message ||
                collection.errors[0]?.error ||
                "Source probe failed before a response was captured.",
            ).slice(0, 300)
          : undefined,
    };
  } catch (error) {
    return {
      source: connector.name,
      status: "unavailable",
      displayStatus: displayStatusFor("unavailable", history),
      reachable: false,
      parserShapeValid: null,
      parserStatus: "Not Checked",
      parserMessage: null,
      sampleRecordsDiscovered: 0,
      sampleDirectoryEntriesDiscovered: 0,
      samplePdfLinksDiscovered: 0,
      pdfDiscoveryStatus: "Not Checked",
      snapshotsCaptured: 0,
      latestIngestionStatus: history.latestRunStatus || null,
      lastSuccessfulIngestion: history.lastSuccessfulAt || null,
      storedSourceRecords: Number(history.documentCount || 0),
      refreshAgeHours: history.lastSuccessfulAt
        ? Math.round(
            ((Date.now() - new Date(history.lastSuccessfulAt).getTime()) /
              3_600_000) *
              10,
          ) / 10
        : null,
      latestStoredError: history.latestError || null,
      errorCount: Number(history.errorCount || 0) + 1,
      durationMs: Date.now() - startedAt,
      error: String(error.message || "Source probe failed").slice(0, 300),
    };
  }
};

const loadIngestionHistory = async () => {
  if (!process.env.DATABASE_URL) return new Map();
  const [runs, successfulRuns, counts] = await Promise.all([
    query(`
      SELECT DISTINCT ON (source_name)
        source_name,
        status,
        errors_json
      FROM ingestion_runs
      ORDER BY source_name, started_at DESC
    `),
    query(`
      SELECT source_name, MAX(completed_at) AS last_successful_at
      FROM ingestion_runs
      WHERE status = 'completed'
        AND completed_at IS NOT NULL
      GROUP BY source_name
    `),
    query(`
      SELECT source_name, COUNT(*)::INTEGER AS document_count
      FROM document_sources
      GROUP BY source_name
    `),
  ]);
  const history = new Map();
  for (const row of runs.rows) {
    history.set(row.source_name, {
      latestRunStatus: row.status,
      errorCount: Array.isArray(row.errors_json) ? row.errors_json.length : 0,
      latestError: Array.isArray(row.errors_json)
        ? row.errors_json.at(-1)?.message || null
        : null,
      documentCount: 0,
    });
  }
  for (const row of successfulRuns.rows) {
    history.set(row.source_name, {
      ...(history.get(row.source_name) || {}),
      lastSuccessfulAt: row.last_successful_at,
    });
  }
  for (const row of counts.rows) {
    history.set(row.source_name, {
      ...(history.get(row.source_name) || {}),
      documentCount: row.document_count,
    });
  }
  return history;
};

const runConnectorHealthChecks = async (connectors, options = {}) => {
  const history = await loadIngestionHistory();
  const reports = [];
  for (const connector of connectors) {
    reports.push(
      await probeConnector(connector, options, {
        history: history.get(connector.name) || {},
      }),
    );
  }
  const statusCounts = reports.reduce((counts, report) => {
    counts[report.status] = (counts[report.status] || 0) + 1;
    return counts;
  }, {});
  return {
    checkedAt: new Date().toISOString(),
    safeMode: {
      catalogWrites: false,
      pdfDownloads: false,
      aiCalls: false,
      vectorWrites: false,
    },
    statusCounts,
    sources: reports,
  };
};

module.exports = {
  PRODUCTION_CONNECTORS,
  countPdfLinks,
  displayStatusFor,
  loadIngestionHistory,
  probeConnector,
  runConnectorHealthChecks,
  validateCollectionShape,
};
