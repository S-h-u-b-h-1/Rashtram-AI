const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const tls = require("node:tls");

const CERTIFICATE_DIRECTORY = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "config",
  "certs",
);

const HOST_CERTIFICATES = Object.freeze([
  {
    domains: ["igod.gov.in"],
    files: ["lets-encrypt-ye1.pem", "isrg-root-ye.pem"],
  },
  {
    domains: ["cci.gov.in", "nmc.org.in"],
    files: ["sectigo-dv-r36.pem"],
  },
  {
    domains: ["cbic.gov.in"],
    files: ["entrust-dv-tls-rsa-ca-2.pem"],
  },
]);

const certificateCache = new Map();
const agentCache = new Map();

const hostnameMatches = (hostname, domain) =>
  hostname === domain || hostname.endsWith(`.${domain}`);

const certificateFilesForHostname = (hostname) => {
  const normalized = String(hostname || "").toLowerCase();
  return HOST_CERTIFICATES.find(({ domains }) =>
    domains.some((domain) => hostnameMatches(normalized, domain)),
  )?.files || [];
};

const loadCertificate = (filename) => {
  if (!certificateCache.has(filename)) {
    certificateCache.set(
      filename,
      fs.readFileSync(path.join(CERTIFICATE_DIRECTORY, filename), "utf8"),
    );
  }
  return certificateCache.get(filename);
};

const httpsAgentForUrl = (value) => {
  const parsed = value instanceof URL ? value : new URL(value);
  if (parsed.protocol !== "https:") return undefined;

  const files = certificateFilesForHostname(parsed.hostname);
  if (!files.length) return undefined;

  const cacheKey = files.join("|");
  if (!agentCache.has(cacheKey)) {
    agentCache.set(
      cacheKey,
      new https.Agent({
        ca: [...tls.rootCertificates, ...files.map(loadCertificate)],
        rejectUnauthorized: true,
      }),
    );
  }
  return agentCache.get(cacheKey);
};

module.exports = {
  CERTIFICATE_DIRECTORY,
  HOST_CERTIFICATES,
  certificateFilesForHostname,
  hostnameMatches,
  httpsAgentForUrl,
};
