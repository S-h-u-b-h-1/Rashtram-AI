const test = require("node:test");
const assert = require("node:assert/strict");
const { buildChecks } = require("../cli/verifyProcessingConfig");

const withEnv = (values, run) => {
  const saved = {};
  const keys = [
    "AI_PROVIDER", "EMBEDDING_PROVIDER", "GEMINI_API_KEY",
    "OPENAI_API_KEY", "PINECONE_API_KEY", "PINECONE_NAMESPACE",
  ];
  for (const key of keys) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  try {
    return run();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
};

const failures = (checks) => checks.filter((c) => !c.ok).map((c) => c.name);

test("reproduces the exact production misconfiguration that burned 326 documents", () => {
  // The corpus-processing workflow as it actually ran: OpenAI key and
  // models present, but AI_PROVIDER unset and no Gemini key. OCR failed
  // on every scanned PDF and nothing stopped the run.
  const checks = withEnv(
    { OPENAI_API_KEY: "x", PINECONE_API_KEY: "x", EMBEDDING_PROVIDER: "openai" },
    buildChecks,
  );
  const failed = failures(checks);
  assert.ok(failed.length > 0, "this configuration must not be allowed to run");
  assert.ok(
    failed.some((name) => /AI_PROVIDER is set explicitly/.test(name)),
    "the unset AI_PROVIDER must be the flagged root cause",
  );
});

test("gemini provider without a gemini key is rejected", () => {
  const checks = withEnv(
    {
      AI_PROVIDER: "gemini",
      EMBEDDING_PROVIDER: "gemini",
      PINECONE_API_KEY: "x",
      PINECONE_NAMESPACE: "ns",
    },
    buildChecks,
  );
  const failed = failures(checks);
  assert.ok(
    failed.some((n) => /GEMINI_API_KEY/.test(n)),
    "EMBEDDING_PROVIDER=gemini with no key produces zero embeddings silently",
  );
});

test("an unpinned Pinecone namespace is rejected", () => {
  // Unpinned, VECTOR_NAMESPACE is derived from the embedding model and can
  // diverge from the namespace the API reads.
  const checks = withEnv(
    {
      AI_PROVIDER: "gemini",
      EMBEDDING_PROVIDER: "gemini",
      GEMINI_API_KEY: "x",
      PINECONE_API_KEY: "x",
    },
    buildChecks,
  );
  assert.ok(failures(checks).some((n) => /PINECONE_NAMESPACE/.test(n)));
});

test("a fully valid gemini configuration passes", () => {
  const checks = withEnv(
    {
      AI_PROVIDER: "gemini",
      EMBEDDING_PROVIDER: "gemini",
      GEMINI_API_KEY: "x",
      PINECONE_API_KEY: "x",
      PINECONE_NAMESPACE: "gemini-embedding-001-768-v1",
    },
    buildChecks,
  );
  assert.deepEqual(failures(checks), []);
});

test("a fully valid openai configuration also passes", () => {
  // The guard enforces coherence, not one specific vendor.
  const checks = withEnv(
    {
      AI_PROVIDER: "openai",
      EMBEDDING_PROVIDER: "openai",
      OPENAI_API_KEY: "x",
      PINECONE_API_KEY: "x",
      PINECONE_NAMESPACE: "text-embedding-3-large-768-v1",
    },
    buildChecks,
  );
  assert.deepEqual(failures(checks), []);
});

test("no check ever exposes a secret value", () => {
  const secret = "super-secret-key-value";
  const checks = withEnv(
    {
      AI_PROVIDER: "gemini",
      EMBEDDING_PROVIDER: "gemini",
      GEMINI_API_KEY: secret,
      PINECONE_API_KEY: secret,
      PINECONE_NAMESPACE: "ns",
    },
    buildChecks,
  );
  const rendered = JSON.stringify(checks);
  assert.ok(!rendered.includes(secret), "only presence may be reported, never the value");
});

test("every failure carries actionable remediation", () => {
  const checks = withEnv({}, buildChecks);
  for (const check of checks.filter((c) => !c.ok)) {
    assert.ok(check.remedy && check.remedy.length > 20, `${check.name} needs a remedy`);
  }
});
