const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MAX_LEGACY_UPLOAD_BYTES,
  MAX_SOURCE_BYTES,
  assertPublicUrl,
  extractHtml,
  findLinkedPdfUrl,
} = require("../research/sourceService");
const { userSourceObjectKey } = require("../lib/storage/objectStorage");

test("direct PDF uploads expose a truthful 50 MB limit and a Vercel-safe legacy fallback", () => {
  assert.equal(MAX_SOURCE_BYTES, 50 * 1024 * 1024);
  assert.equal(MAX_LEGACY_UPLOAD_BYTES, 3 * 1024 * 1024);
  assert.equal(
    userSourceObjectKey({ userId: 42, uploadId: "123e4567-e89b-12d3-a456-426614174000" }),
    "rashtram/user-sources/42/123e4567-e89b-12d3-a456-426614174000.pdf",
  );
});

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

test("official ASP.NET form wrappers retain publication text instead of being discarded", () => {
  const extracted = extractHtml(Buffer.from(`<!doctype html><html><body>
    <form method="post"><main><h1>Official consultation</h1>
    <p>The regulator invites comments on proposed reporting, implementation, and review requirements for regulated entities.</p>
    <p>Responses should address administrative capacity, consumer safeguards, and phased commencement.</p>
    </main></form></body></html>`), "https://regulator.example.gov.in/report.aspx?id=42");
  assert.match(extracted.text, /invites comments/);
  assert.equal(extracted.quality.valid, true);
});

test("official publication pages can resolve a linked PDF regardless of wrapper extension", () => {
  const url = findLinkedPdfUrl(Buffer.from(`
    <a href="/web/?file=https%3A%2F%2Fregulator.example.gov.in%2Ffiles%2Fconsultation.pdf%23page%3D2">Open report</a>
  `), "https://regulator.example.gov.in/publication.aspx?id=42");
  assert.equal(url, "https://regulator.example.gov.in/files/consultation.pdf#page=2");
});
