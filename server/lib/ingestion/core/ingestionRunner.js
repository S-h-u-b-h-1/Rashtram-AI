const {
  completeRun,
  createRun,
  findCandidates,
  persistRecord,
  storeSnapshots,
} = require("./catalogRepository");
const { chooseBestCandidate } = require("./dedupe");
const { PoliteFetcher } = require("./fetcher");
const { normalizeRecord } = require("./normalizer");

const runIngestion = async (connector, options = {}) => {
  if (!connector?.name || typeof connector.collect !== "function") {
    throw new Error("A connector with name and collect() is required");
  }

  const run = await createRun({
    sourceName: connector.name,
    collectionName: options.collection || connector.defaultCollection,
    options,
  });
  const summary = {
    runId: run.id,
    source: connector.name,
    collection: options.collection || connector.defaultCollection || null,
    status: "completed",
    discovered: 0,
    stored: 0,
    resources: 0,
    counters: {
      created: 0,
      merged: 0,
      reviewsQueued: 0,
      snapshots: 0,
      relationships: 0,
    },
    errors: [],
  };

  try {
    const fetcher =
      options.fetcher ||
      new PoliteFetcher({
        delayMs: options.delayMs,
        timeoutMs: options.timeoutMs,
        retries: options.retries,
      });
    const collection = await connector.collect(options, { fetcher });
    const records = collection.records || [];
    summary.discovered = records.length;
    summary.errors.push(...(collection.errors || []));

    for (const rawRecord of records) {
      try {
        const record = normalizeRecord(rawRecord);
        const candidates = await findCandidates(record);
        const decision = chooseBestCandidate(record, candidates);
        const persisted = await persistRecord(record, decision);
        summary.stored += 1;
        summary.resources += persisted.resources;
        summary.counters.relationships += persisted.relationships;
        summary.counters[persisted.action] += 1;
        if (persisted.reviewQueued) summary.counters.reviewsQueued += 1;
      } catch (error) {
        summary.errors.push({
          sourceRecordId:
            rawRecord.sourceRecordId || rawRecord.sourceDocumentId || null,
          message: error.message,
        });
      }
    }

    summary.counters.snapshots = await storeSnapshots(
      collection.snapshots || [],
    );
    if (summary.errors.length) summary.status = "completed_with_errors";
  } catch (error) {
    summary.status = "failed";
    summary.errors.push({ message: error.message });
  }

  await completeRun(run.id, summary);
  return summary;
};

module.exports = {
  runIngestion,
};
