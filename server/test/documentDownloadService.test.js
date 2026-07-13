const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  classifyDownloadError,
  downloadAndValidateDocument,
  retryAfterMs,
} = require("../lib/documentDownloadService");
const {
  validateDownloadedFile,
} = require("../lib/documentFileValidator");
const { FAILURE_CODES } = require("../document/failureTaxonomy");

const withServer = async (handler, fn) => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test("download validator rejects HTML, zero-byte and invalid PDF signatures", async () => {
  const html = await validateDownloadedFile(Buffer.from("<!doctype html><p>blocked</p>"), {
    contentType: "text/html",
  });
  assert.equal(html.ok, false);
  assert.equal(html.failureCode, FAILURE_CODES.DOWNLOAD_HTML_RESPONSE);

  const empty = await validateDownloadedFile(Buffer.alloc(0));
  assert.equal(empty.failureCode, FAILURE_CODES.DOWNLOAD_ZERO_BYTE);

  const invalid = await validateDownloadedFile(Buffer.from("not a pdf"), {
    contentType: "application/pdf",
  });
  assert.equal(invalid.failureCode, FAILURE_CODES.DOWNLOAD_UNSUPPORTED_CONTENT);
});

test("download validator detects duplicate checksums before promotion", async () => {
  const buffer = Buffer.from("not a pdf");
  const checksum = require("../lib/documentFileValidator").sha256Buffer(buffer);
  const result = await validateDownloadedFile(buffer, {
    existingChecksums: new Set([checksum]),
  });
  assert.equal(result.duplicateExistingFile, true);
});

test("downloader classifies 404 and 403 without retry bypass", async () => {
  await withServer((req, res) => {
    res.writeHead(req.url === "/denied.pdf" ? 403 : 404);
    res.end("blocked");
  }, async (baseUrl) => {
    await assert.rejects(
      () => downloadAndValidateDocument(`${baseUrl}/missing.pdf`, {
        retries: 2,
        allowPrivateNetwork: true,
      }),
      (error) => error.failureCode === FAILURE_CODES.DOWNLOAD_NOT_FOUND,
    );
    await assert.rejects(
      () => downloadAndValidateDocument(`${baseUrl}/denied.pdf`, {
        retries: 2,
        allowPrivateNetwork: true,
      }),
      (error) => error.failureCode === FAILURE_CODES.DOWNLOAD_ACCESS_DENIED,
    );
  });
});

test("downloader retries 500 and honors Retry-After-shaped inputs", async () => {
  let requests = 0;
  await withServer((req, res) => {
    requests += 1;
    res.writeHead(500, { "Retry-After": "0" });
    res.end("temporary");
  }, async (baseUrl) => {
    await assert.rejects(
      () => downloadAndValidateDocument(`${baseUrl}/file.pdf`, {
        retries: 2,
        allowPrivateNetwork: true,
      }),
      (error) => error.failureCode === FAILURE_CODES.DOWNLOAD_SERVER_ERROR,
    );
  });
  assert.equal(requests, 3);
  assert.equal(retryAfterMs("0"), 0);
});

test("downloader detects redirect loops and removes temporary files", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rashtram-test-download-"));
  await withServer((req, res) => {
    res.writeHead(302, { Location: req.url === "/a" ? "/b" : "/a" });
    res.end();
  }, async (baseUrl) => {
    await assert.rejects(
      () => downloadAndValidateDocument(`${baseUrl}/a`, {
        retries: 0,
        maxRedirects: 2,
        tempDir,
        allowPrivateNetwork: true,
      }),
      (error) => error.failureCode === FAILURE_CODES.DOWNLOAD_REDIRECT_LOOP,
    );
  });
  const leftovers = await fs.readdir(tempDir);
  assert.deepEqual(leftovers, []);
  await fs.rm(tempDir, { recursive: true, force: true });
});

test("download error classifier handles DNS, TLS, timeout and truncation", () => {
  assert.equal(
    classifyDownloadError({ code: "ENOTFOUND" }),
    FAILURE_CODES.DOWNLOAD_DNS_FAILED,
  );
  assert.equal(
    classifyDownloadError({ message: "self signed certificate" }),
    FAILURE_CODES.DOWNLOAD_TLS_FAILED,
  );
  assert.equal(
    classifyDownloadError({ code: "ECONNABORTED", message: "timeout" }),
    FAILURE_CODES.DOWNLOAD_TIMEOUT,
  );
  assert.equal(
    classifyDownloadError({ message: "content-length mismatch" }),
    FAILURE_CODES.DOWNLOAD_TRUNCATED,
  );
});
