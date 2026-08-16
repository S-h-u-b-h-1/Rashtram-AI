const assert = require("node:assert/strict");
const test = require("node:test");
const { assertPublicUrl, extractHtml } = require("../research/sourceService");

test("research source URL guard rejects local and credential-bearing URLs", async () => {
  await assert.rejects(() => assertPublicUrl("http://127.0.0.1:5001/private"));
  await assert.rejects(() => assertPublicUrl("http://localhost:3000"));
  await assert.rejects(() => assertPublicUrl("https://user:password@example.com/report"));
});

test("research source URL guard accepts a public HTTPS host", async () => {
  const parsed = await assertPublicUrl("https://example.com/research");
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.hostname, "example.com");
});

test("external HTML extraction prefers the article over navigation and footer noise", () => {
  const extracted = extractHtml(
    Buffer.from(`<!doctype html><html><head>
      <meta property="og:title" content="Clean policy title">
      <meta name="description" content="Official policy description.">
    </head><body>
      <nav>Navigation item that must not become evidence.</nav>
      <article><h1>Clean policy title</h1><p>This policy establishes a national implementation framework with accountable institutions, timelines, and public reporting duties.</p></article>
      <footer>Footer text that must not become evidence.</footer>
    </body></html>`),
    "https://example.com/policy",
  );

  assert.equal(extracted.title, "Clean policy title");
  assert.match(extracted.text, /national implementation framework/);
  assert.doesNotMatch(extracted.text, /Navigation item/);
  assert.doesNotMatch(extracted.text, /Footer text/);
  assert.equal(extracted.extractionMethod, "source_html");
});

test("external HTML extraction reads structured article data from script-rendered pages", () => {
  const extracted = extractHtml(
    Buffer.from(`<!doctype html><html><head><title>Rendered shell</title>
      <script type="application/ld+json">{
        "@type": "Article",
        "headline": "Structured policy page",
        "articleBody": "The authority must publish quarterly implementation reports, consult affected institutions, and review compliance annually."
      }</script>
    </head><body><div id="app">Loading...</div></body></html>`),
    "https://example.com/rendered-policy",
  );

  assert.match(extracted.text, /publish quarterly implementation reports/);
  assert.equal(extracted.extractionMethod, "structured_html");
});
