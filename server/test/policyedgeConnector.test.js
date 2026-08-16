const assert = require("node:assert/strict");
const test = require("node:test");
const {
  mapApiArticle,
} = require("../lib/ingestion/connectors/policyedgeConnector");

test("PolicyEdge API articles preserve the public link and prefer plain content", () => {
  const article = mapApiArticle({
    slug: "sample-policy",
    title: "Sample policy",
    summary: "A verified summary.",
    plain_content: "Complete readable policy text with implementation details.",
    content: "<p>HTML fallback that should not be selected.</p>",
    publishDate: "2026-08-15",
    categories: [{ name: "Reports/Data Releases" }],
    institutions: [{ name: "Ministry of Finance" }],
    tags: [{ name: "Taxation" }],
  });

  assert.equal(article.url, "https://www.policyedge.in/p/sample-policy");
  assert.equal(article.bodyText, "Complete readable policy text with implementation details.");
  assert.deepEqual(article.institutions, ["Ministry of Finance"]);
  assert.deepEqual(article.sdgTags, ["Taxation"]);
  assert.equal(article.extractionSource, "policyedge_api");
});

test("PolicyEdge API articles fall back to cleaned HTML content", () => {
  const article = mapApiArticle({
    slug: "html-only-policy",
    title: "HTML-only policy",
    content: "<article><p>Readable policy body &amp; implementation evidence.</p></article>",
  });

  assert.equal(article.bodyText, "Readable policy body & implementation evidence.");
});
