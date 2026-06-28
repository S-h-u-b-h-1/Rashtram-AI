const fs = require("fs/promises");
const path = require("path");
const {
  generateSourceStableId,
  sha256Buffer,
} = require("./hashing");

const PDF_STORAGE_BACKENDS = new Set([
  "url-only",
  "filesystem",
  "database",
  "object-storage",
]);

const pdfUrlFromRecord = (record) =>
  record.pdfUrl ||
  (record.resources || []).find(
    (resource) =>
      resource.resourceType === "pdf" ||
      /\.pdf(?:$|[?#])/i.test(resource.url || ""),
  )?.url ||
  null;

const validatePdfStorageOptions = (options = {}) => {
  const storage = String(options.pdfStorage || "url-only").toLowerCase();
  if (!PDF_STORAGE_BACKENDS.has(storage)) {
    throw new Error(`Unsupported PDF storage backend: ${storage}`);
  }
  if (
    options.downloadPdfs &&
    ["database", "object-storage"].includes(storage)
  ) {
    throw new Error(
      `${storage} PDF storage is not configured. Use url-only or filesystem.`,
    );
  }
  if (
    options.downloadPdfs &&
    storage === "filesystem" &&
    !(options.pdfStorageDir || process.env.PDF_STORAGE_DIR)
  ) {
    throw new Error(
      "PDF_STORAGE_DIR is required when --pdf-storage=filesystem.",
    );
  }
  return storage;
};

const downloadPdfForRecord = async (record, fetcher, options = {}) => {
  const pdfUrl = pdfUrlFromRecord(record);
  if (!pdfUrl) return { record, downloaded: false, stored: false };

  const storage = validatePdfStorageOptions(options);
  const maximumBytes = Number(options.maxPdfBytes || 25 * 1024 * 1024);
  const response = await fetcher.getBuffer(pdfUrl, {
    maxContentLength: maximumBytes,
    maxBodyLength: maximumBytes,
  });
  if (response.body.length > maximumBytes) {
    throw new Error(`PDF exceeds the ${maximumBytes}-byte safety limit.`);
  }
  if (response.body.subarray(0, 4).toString() !== "%PDF") {
    throw new Error("Downloaded resource does not have a PDF signature.");
  }

  const pdfHash = sha256Buffer(response.body);
  let storagePath = null;
  if (storage === "filesystem") {
    const directory = path.resolve(
      options.pdfStorageDir || process.env.PDF_STORAGE_DIR,
    );
    await fs.mkdir(directory, { recursive: true });
    const filename = `${generateSourceStableId(
      record.sourceName,
      record.sourceRecordId,
      pdfHash,
    )}.pdf`;
    storagePath = path.join(directory, filename);
    await fs.writeFile(storagePath, response.body, { flag: "wx" }).catch(
      (error) => {
        if (error.code !== "EEXIST") throw error;
      },
    );
  }

  return {
    downloaded: true,
    stored: Boolean(storagePath),
    record: {
      ...record,
      pdfUrl,
      pdfHash,
      contentHash: record.contentHash || pdfHash,
      metadata: {
        ...(record.metadata || {}),
        pdfAsset: {
          hash: pdfHash,
          sizeBytes: response.body.length,
          storage,
          storagePath,
          verifiedAt: new Date().toISOString(),
        },
      },
    },
  };
};

module.exports = {
  PDF_STORAGE_BACKENDS,
  downloadPdfForRecord,
  pdfUrlFromRecord,
  validatePdfStorageOptions,
};
