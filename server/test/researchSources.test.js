const assert = require("node:assert/strict");
const test = require("node:test");
const { assertPublicUrl } = require("../research/sourceService");

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
