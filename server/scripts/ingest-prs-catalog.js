#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const {
  SOURCE_DEFINITIONS,
  crawlDefinition,
  parseBillDetail,
  requestPage,
  sleep,
} = require("../lib/prsCatalog");
const {
  completeIngestionRun,
  createIngestionRun,
  getCatalogStats,
  storeSnapshots,
  upsertDocuments,
  upsertResources,
} = require("../lib/catalogRepository");
const { getPool } = require("../db");

const readArguments = (argumentsList) => {
  const options = {
    collections: SOURCE_DEFINITIONS.map((definition) => definition.key),
    details: true,
    delayMs: 175,
    maxPages: 500,
    detailConcurrency: 4,
  };

  for (const argument of argumentsList) {
    if (argument === "--catalog-only") options.details = false;
    if (argument === "--details") options.details = true;
    if (argument.startsWith("--collections=")) {
      options.collections = argument
        .slice("--collections=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }
    if (argument.startsWith("--delay-ms=")) {
      options.delayMs = Number(argument.slice("--delay-ms=".length));
    }
    if (argument.startsWith("--max-pages=")) {
      options.maxPages = Number(argument.slice("--max-pages=".length));
    }
    if (argument.startsWith("--detail-concurrency=")) {
      options.detailConcurrency = Number(
        argument.slice("--detail-concurrency=".length),
      );
    }
  }

  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
  }
  if (!Number.isInteger(options.maxPages) || options.maxPages < 1) {
    throw new Error("--max-pages must be a positive integer");
  }
  if (
    !Number.isInteger(options.detailConcurrency) ||
    options.detailConcurrency < 1 ||
    options.detailConcurrency > 8
  ) {
    throw new Error("--detail-concurrency must be between 1 and 8");
  }

  const knownCollections = new Set(
    SOURCE_DEFINITIONS.map((definition) => definition.key),
  );
  const unknownCollections = options.collections.filter(
    (collection) => !knownCollections.has(collection),
  );
  if (unknownCollections.length) {
    throw new Error(
      `Unknown collection(s): ${unknownCollections.join(", ")}`,
    );
  }

  return options;
};

const enrichParliamentBills = async (documents, options, errors) => {
  const bills = documents.filter(
    (document) =>
      document.documentType === "bill" &&
      document.jurisdictionLevel === "parliament" &&
      document.detailUrl,
  );
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (cursor < bills.length) {
      const index = cursor;
      cursor += 1;
      const document = bills[index];

      try {
        const html = await requestPage(document.detailUrl);
        const detail = parseBillDetail(html, document.detailUrl);
        document.title = detail.title || document.title;
        document.year = detail.year || document.year;
        document.status = document.status || detail.status;
        document.ministry = detail.ministry || document.ministry;
        document.category = detail.category || document.category;
        document.pdfUrl = detail.pdfUrl || document.pdfUrl;
        document.resources = detail.resources;
        document.sourceMetadata = {
          ...document.sourceMetadata,
          detail: {
            ...detail.metadata,
            pageStatus: detail.status,
          },
          detailFetchedAt: new Date().toISOString(),
        };
      } catch (error) {
        errors.push({
          stage: "bill-detail",
          sourceUrl: document.detailUrl,
          message: error.message,
        });
      }

      completed += 1;
      if (completed % 50 === 0 || completed === bills.length) {
        console.log(
          `  enriched ${completed}/${bills.length} Parliament bill pages`,
        );
      }
      if (options.delayMs > 0) await sleep(options.delayMs);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(options.detailConcurrency, bills.length) },
      () => worker(),
    ),
  );

  return bills.length;
};

const main = async () => {
  const options = readArguments(process.argv.slice(2));
  const run = await createIngestionRun(options);
  const errors = [];
  const documentsById = new Map();
  const snapshots = [];
  let resourcesStored = 0;

  console.log(`PRS catalogue ingestion run ${run.id}`);
  console.log(`Collections: ${options.collections.join(", ")}`);

  try {
    for (const definition of SOURCE_DEFINITIONS.filter((item) =>
      options.collections.includes(item.key),
    )) {
      console.log(`Collecting ${definition.key}...`);
      try {
        const result = await crawlDefinition(definition, options);
        for (const document of result.documents) {
          documentsById.set(document.sourceDocumentId, document);
        }
        snapshots.push(...result.snapshots);
        console.log(
          `  found ${result.documents.length} documents across ${result.pagesFetched} page(s)`,
        );
      } catch (error) {
        errors.push({
          stage: "collection",
          collection: definition.key,
          message: error.message,
        });
        console.error(`  failed: ${error.message}`);
      }
    }

    const documents = [...documentsById.values()];
    console.log(`Storing ${documents.length} catalogue records...`);
    let identifiers = await upsertDocuments(documents);
    resourcesStored += await upsertResources(documents, identifiers);
    await storeSnapshots(snapshots);

    if (options.details && options.collections.includes("parliament-bills")) {
      console.log("Enriching Parliament bill details and linked resources...");
      await enrichParliamentBills(documents, options, errors);
      identifiers = await upsertDocuments(documents);
      resourcesStored += await upsertResources(documents, identifiers);
    }

    const stats = await getCatalogStats();
    const status = errors.length ? "completed_with_errors" : "completed";
    await completeIngestionRun(run.id, {
      status,
      recordsDiscovered: documents.length,
      recordsStored: documents.length,
      resourcesStored,
      errors,
    });

    console.log(
      JSON.stringify(
        {
          runId: run.id,
          status,
          collectedThisRun: documents.length,
          snapshotsStored: snapshots.length,
          resourcesSeenThisRun: resourcesStored,
          errors: errors.length,
          catalog: stats,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    errors.push({ stage: "fatal", message: error.message });
    await completeIngestionRun(run.id, {
      status: "failed",
      recordsDiscovered: documentsById.size,
      recordsStored: 0,
      resourcesStored,
      errors,
    });
    throw error;
  } finally {
    await getPool().end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
