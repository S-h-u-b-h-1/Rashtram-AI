const {
  completeRun,
  createRun,
  findCandidates,
  persistRecord,
  recordRunItem,
  storeSnapshots,
  upsertDirectoryEntries,
} = require("./catalogRepository");
const { chooseBestCandidate } = require("./dedupe");
const { PoliteFetcher } = require("./fetcher");
const { normalizeRecord } = require("./normalizer");
const {
  downloadPdfForRecord,
  pdfUrlFromRecord,
  validatePdfStorageOptions,
} = require("./pdfDownload");

const countPdfUrls = (record) =>
  new Set(
    [
      record.pdfUrl,
      ...(record.resources || [])
        .filter(
          (resource) =>
            resource.resourceType === "pdf" ||
            /\.pdf(?:$|[?#])/i.test(resource.url || ""),
        )
        .map((resource) => resource.url),
    ].filter(Boolean),
  ).size;

const dateInRange = (record, options) => {
  const value =
    record.publicationDate ||
    record.enactedDate ||
    record.introducedDate ||
    record.effectiveDate;
  if (!value) return !options.from && !options.to;
  const date = String(value).slice(0, 10);
  return (!options.from || date >= options.from) &&
    (!options.to || date <= options.to);
};

const matchesRequestedScope = (record, options) => {
  const equals = (left, right) =>
    String(left || "").toLowerCase() === String(right || "").toLowerCase();
  if (!dateInRange(record, options)) return false;
  if (
    options.state &&
    !equals(record.state || record.jurisdiction, options.state)
  ) return false;
  if (options.ministry && !equals(record.ministry, options.ministry)) return false;
  if (
    options.regulator &&
    ![
      record.sourceName,
      record.authority,
    ].some((value) => String(value || "").toLowerCase().includes(
      String(options.regulator).toLowerCase(),
    ))
  ) return false;
  if (options.category && !equals(record.category, options.category)) return false;
  return true;
};

const runIngestion = async (connector, options = {}) => {
  if (!connector?.name || typeof connector.collect !== "function") {
    throw new Error("A connector with name and collect() is required");
  }

  const requestedCollection =
    options.collection || options.collections || connector.defaultCollection;
  const run = options.dryRun
    ? { id: null }
    : await createRun({
        sourceName: connector.name,
        collectionName: requestedCollection,
        options,
      });
  const summary = {
    runId: run.id,
    source: connector.name,
    collection: requestedCollection || null,
    status: "completed",
    discovered: 0,
    stored: 0,
    resources: 0,
    counters: {
      discovered: 0,
      inserted: 0,
      updated: 0,
      duplicate_sources_added: 0,
      pdf_urls_found: 0,
      errors: 0,
      skipped: 0,
      manual_review_required: 0,
      duplicates_skipped: 0,
      created: 0,
      merged: 0,
      reviewsQueued: 0,
      snapshots: 0,
      relationships: 0,
      directory_entries: 0,
      downloaded_pdfs: 0,
      stored_pdfs: 0,
      pdf_download_errors: 0,
      validated: 0,
    },
    errors: [],
    sampleRecords: [],
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
    const records = (collection.records || []).filter((record) =>
      matchesRequestedScope(record, options),
    );
    const directoryEntries = collection.directoryEntries || [];
    summary.discovered = records.length;
    summary.counters.discovered = records.length;
    summary.counters.directory_entries = options.dryRun
      ? directoryEntries.length
      : await upsertDirectoryEntries(directoryEntries);
    summary.errors.push(...(collection.errors || []));
    for (const diagnostic of collection.diagnostics || []) {
      if (!["blocked", "error"].includes(diagnostic.type)) continue;
      summary.errors.push({
        stage: "access",
        type: diagnostic.type,
        collection: diagnostic.collection || summary.collection,
        message:
          diagnostic.message ||
          `Connector reported ${diagnostic.type} access.`,
      });
    }

    const maximumPdfDownloads = Math.max(0, Number(options.maxPdfs || 100));
    if (options.downloadPdfs) validatePdfStorageOptions(options);

    for (const rawRecord of records) {
      try {
        let record = normalizeRecord(rawRecord);
        if (
          options.downloadPdfs &&
          summary.counters.downloaded_pdfs < maximumPdfDownloads &&
          pdfUrlFromRecord(record)
        ) {
          try {
            const pdf = await downloadPdfForRecord(record, fetcher, options);
            record = pdf.record;
            if (pdf.downloaded) summary.counters.downloaded_pdfs += 1;
            if (pdf.stored) summary.counters.stored_pdfs += 1;
          } catch (error) {
            summary.counters.pdf_download_errors += 1;
            summary.errors.push({
              sourceRecordId: record.sourceRecordId,
              stage: "pdf-download",
              message: error.message,
            });
          }
        }
        summary.counters.pdf_urls_found += countPdfUrls(record);
        if (options.dryRun) {
          summary.stored += 1;
          summary.counters.validated += 1;
          if (summary.sampleRecords.length < 10) {
            summary.sampleRecords.push({
              sourceName: record.sourceName,
              sourceRecordId: record.sourceRecordId,
              title: record.title,
              documentType: record.documentType,
              jurisdiction: record.jurisdiction,
              publicationDate: record.publicationDate,
              sourceUrl: record.sourceUrl,
              pdfUrl: record.pdfUrl,
            });
          }
          continue;
        }
        const candidates = await findCandidates(record);
        const decision = chooseBestCandidate(record, candidates);
        const persisted = await persistRecord(record, decision);
        await recordRunItem({
          runId: run.id,
          sourceRecordId: record.sourceRecordId,
          documentId: persisted.documentId,
          status: "stored",
          action: persisted.action,
          metadata: {
            matchReason: persisted.matchReason,
            sourceAdded: persisted.sourceAdded,
            resources: persisted.resources,
          },
        });
        summary.stored += 1;
        summary.resources += persisted.resources;
        summary.counters.relationships += persisted.relationships;
        summary.counters[persisted.action] += 1;
        if (persisted.action === "created") {
          summary.counters.inserted += 1;
        } else if (persisted.sourceAdded) {
          summary.counters.duplicate_sources_added += 1;
        } else if (persisted.changed) {
          summary.counters.updated += 1;
        } else {
          summary.counters.duplicates_skipped += 1;
        }
        if (persisted.reviewQueued) {
          summary.counters.reviewsQueued += 1;
          summary.counters.manual_review_required += 1;
        }
      } catch (error) {
        summary.counters.skipped += 1;
        await recordRunItem({
          runId: run.id,
          sourceRecordId:
            rawRecord.sourceRecordId || rawRecord.sourceDocumentId || null,
          status: "failed",
          errorMessage: error.message,
        }).catch(() => undefined);
        summary.errors.push({
          sourceRecordId:
            rawRecord.sourceRecordId || rawRecord.sourceDocumentId || null,
          message: error.message,
        });
      }
    }

    summary.counters.snapshots = options.dryRun
      ? collection.snapshots?.length || 0
      : await storeSnapshots(collection.snapshots || []);
    summary.counters.errors = summary.errors.length;
    if (summary.errors.length) summary.status = "completed_with_errors";
  } catch (error) {
    summary.status = "failed";
    summary.errors.push({ message: error.message });
    summary.counters.errors = summary.errors.length;
  }

  if (!options.dryRun) await completeRun(run.id, summary);
  return summary;
};

module.exports = {
  countPdfUrls,
  dateInRange,
  matchesRequestedScope,
  runIngestion,
};
