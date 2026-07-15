const assert = require("node:assert/strict");
const fs = require("node:fs");
const { X509Certificate } = require("node:crypto");
const path = require("node:path");
const test = require("node:test");

const {
  CERTIFICATE_DIRECTORY,
  certificateFilesForHostname,
  hostnameMatches,
  httpsAgentForUrl,
} = require("../lib/ingestion/core/tlsTrust");

test("host-scoped trust only applies to explicitly configured official domains", () => {
  assert.equal(hostnameMatches("igod.gov.in", "igod.gov.in"), true);
  assert.equal(hostnameMatches("www.cci.gov.in", "cci.gov.in"), true);
  assert.equal(hostnameMatches("fakecci.gov.in", "cci.gov.in"), false);

  assert.deepEqual(certificateFilesForHostname("igod.gov.in"), [
    "lets-encrypt-ye1.pem",
    "isrg-root-ye.pem",
  ]);
  assert.deepEqual(certificateFilesForHostname("www.nmc.org.in"), [
    "sectigo-dv-r36.pem",
  ]);
  assert.deepEqual(certificateFilesForHostname("taxinformation.cbic.gov.in"), [
    "entrust-dv-tls-rsa-ca-2.pem",
  ]);
  assert.deepEqual(certificateFilesForHostname("example.com"), []);
});

test("custom agents preserve certificate verification", () => {
  const agent = httpsAgentForUrl("https://www.cci.gov.in/path");
  assert.ok(agent);
  assert.equal(agent.options.rejectUnauthorized, true);
  assert.equal(httpsAgentForUrl("https://example.com"), undefined);
  assert.equal(httpsAgentForUrl("http://igod.gov.in"), undefined);
});

test("bundled public intermediates are valid and unexpired", () => {
  const now = Date.now();
  for (const filename of [
    "lets-encrypt-ye1.pem",
    "isrg-root-ye.pem",
    "sectigo-dv-r36.pem",
    "entrust-dv-tls-rsa-ca-2.pem",
  ]) {
    const certificate = new X509Certificate(
      fs.readFileSync(path.join(CERTIFICATE_DIRECTORY, filename)),
    );
    assert.ok(Date.parse(certificate.validFrom) <= now, filename);
    assert.ok(Date.parse(certificate.validTo) > now, filename);
  }
});
