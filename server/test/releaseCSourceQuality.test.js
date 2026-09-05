const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const {
  EVIDENCE_STATUS,
  EXTRACTION_STATUS,
  SOURCE_AUTHORITY_CLASSES,
  assessExternalSourceQuality,
  chooseCanonicalSourceUrl,
  classifyDetailedAuthority,
  evidenceStatusFor,
} = (() => {
  const quality = require("../research/sourceQuality");
  const { SOURCE_AUTHORITY_CLASSES } = require("../lib/ingestion/core/sourcePolicy");
  return { ...quality, SOURCE_AUTHORITY_CLASSES };
})();
const {
  SOURCE_AUTHORITY,
  classifySourceAuthority,
} = require("../retrieval/sourceAuthority");
const { assertPublicUrl, getSourceContext } = require("../research/sourceService");

const goodExtraction = {
  text: "A".repeat(2_000),
  quality: { valid: true, normalizedCharacters: 2_000, reasons: [] },
};

test("verified domains and connector identities determine authority, not page wording", () => {
  assert.equal(classifyDetailedAuthority({
    sourceUrl: "https://www.indiacode.nic.in/show-data",
    sourceType: "external_url",
  }), SOURCE_AUTHORITY_CLASSES.OFFICIAL_PRIMARY);
  assert.equal(classifyDetailedAuthority({
    sourceUrl: "https://www.rbi.org.in/Scripts/NotificationUser.aspx",
    sourceType: "external_url",
  }), SOURCE_AUTHORITY_CLASSES.OFFICIAL_REGULATORY);
  assert.equal(classifyDetailedAuthority({
    sourceUrl: "https://www.who.int/publications/example",
    sourceType: "external_url",
  }), SOURCE_AUTHORITY_CLASSES.INSTITUTIONAL_SECONDARY);
  assert.equal(classifyDetailedAuthority({
    sourceUrl: "https://example.com/ministry-authority-notice",
    sourceType: "external_url",
  }), SOURCE_AUTHORITY_CLASSES.GENERIC_WEB);
});

test("fetch success, extraction quality, authority, and evidence usability remain separate", () => {
  const official = assessExternalSourceQuality({
    sourceUrl: "https://example.gov.in/notice",
    sourceType: "external_url",
    extracted: goodExtraction,
  });
  assert.equal(official.fetchStatus, "SUCCESS");
  assert.equal(official.extractionStatus, EXTRACTION_STATUS.GOOD);
  assert.equal(official.authorityClass, SOURCE_AUTHORITY_CLASSES.OFFICIAL_GOVERNMENT);
  assert.equal(official.evidenceStatus, EVIDENCE_STATUS.USABLE);

  const generic = assessExternalSourceQuality({
    sourceUrl: "https://example.com/policy",
    sourceType: "external_url",
    extracted: goodExtraction,
  });
  assert.equal(generic.extractionStatus, EXTRACTION_STATUS.GOOD);
  assert.equal(generic.authorityClass, SOURCE_AUTHORITY_CLASSES.GENERIC_WEB);
  assert.equal(generic.evidenceStatus, EVIDENCE_STATUS.LIMITED);
  assert.equal(evidenceStatusFor({
    authorityClass: generic.authorityClass,
    extractionStatus: generic.extractionStatus,
    purpose: "current_status",
    sourceType: "external_url",
  }), EVIDENCE_STATUS.NOT_USABLE);
});

test("low-quality extraction is never promoted by an official hostname", () => {
  const quality = assessExternalSourceQuality({
    sourceUrl: "https://example.gov.in/loading",
    sourceType: "external_url",
    extracted: {
      text: "Loading access page".repeat(10),
      quality: { valid: false, normalizedCharacters: 190, reasons: ["dynamic_shell"] },
    },
  });
  assert.equal(quality.authorityClass, SOURCE_AUTHORITY_CLASSES.OFFICIAL_GOVERNMENT);
  assert.equal(quality.extractionStatus, EXTRACTION_STATUS.LOW_QUALITY);
  assert.equal(quality.evidenceStatus, EVIDENCE_STATUS.NOT_USABLE);
});

test("canonical URLs stay on the verified fetch host and lose tracking parameters", () => {
  assert.equal(chooseCanonicalSourceUrl({
    requestedUrl: "https://example.gov.in/search?q=notice",
    finalUrl: "https://example.gov.in/notices/12",
    extractedCanonicalUrl: "https://example.gov.in/notices/12?utm_source=test#main",
  }), "https://example.gov.in/notices/12");
  assert.equal(chooseCanonicalSourceUrl({
    finalUrl: "https://example.gov.in/notices/12",
    extractedCanonicalUrl: "https://mirror.invalid/notices/12",
  }), "https://example.gov.in/notices/12");
});

test("generic researcher links no longer become legal authority merely because they are user-selected", () => {
  assert.equal(classifySourceAuthority({
    userSource: true,
    sourceType: "external_url",
    sourceUrl: "https://example.com/legal-opinion",
  }), SOURCE_AUTHORITY.UNKNOWN);
  assert.equal(classifySourceAuthority({
    userSource: true,
    sourceType: "pdf_upload",
  }), SOURCE_AUTHORITY.USER_SOURCE);
});

test("strict source context rejects generic web evidence and returns a clear limitation", async () => {
  const row = {
    id: 7,
    title: "Generic policy page",
    source_url: "https://example.com/policy",
    file_name: null,
    source_type: "external_url",
    source_metadata_json: {
      authorityClass: SOURCE_AUTHORITY_CLASSES.GENERIC_WEB,
      extractionStatus: EXTRACTION_STATUS.GOOD,
    },
    chunk_index: 0,
    content: "A generic page describes a claimed legal requirement.",
    chunk_metadata_json: {},
  };
  const result = await getSourceContext(1, [7], "Is this still current?", {
    purpose: "current_status",
    queryFn: async () => ({ rows: [row] }),
  });
  assert.equal(result.context, "");
  assert.equal(result.sources.length, 0);
  assert.equal(result.limitations.length, 1);
  assert.match(result.limitations[0].reason, /not authoritative enough/i);
});

test("unsafe URL failures return the external-source quality contract", async () => {
  await assert.rejects(
    () => assertPublicUrl("http://127.0.0.1/private"),
    (error) => {
      assert.equal(error.failureCode, "URL_UNSUPPORTED");
      assert.deepEqual(error.details, {
        fetchStatus: "FAILED",
        extractionStatus: "FAILED",
        evidenceStatus: "NOT_USABLE",
      });
      return true;
    },
  );
});

test("the study shelf displays the public authority label supplied by the API", () => {
  const component = fs.readFileSync(path.resolve(
    __dirname,
    "../../client/src/components/document-chat/StudySourcesPanel.jsx",
  ), "utf8");
  assert.match(component, /source\.sourceLabel/);
  assert.match(component, /External web source/);
});
