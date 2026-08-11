#!/usr/bin/env node

// Preflight validation for the corpus-processing workflow.
//
// Exists because of a real incident: the workflow ran with neither
// AI_PROVIDER nor GEMINI_API_KEY set. OCR therefore failed on every
// scanned PDF, 326 documents were burned into a failed state, and the
// error was recorded under a misleading code. Nothing stopped the run —
// it dequeued jobs, mutated document state, and produced dead-letter
// noise for hours while being fundamentally misconfigured.
//
// A misconfigured run is worse than no run: it consumes queue attempts,
// advances retry counters toward dead-letter, and writes partial state.
// So this fails fast, BEFORE any job is dequeued.
//
// It never prints a secret — only whether one is present.

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const present = (name) => Boolean(String(process.env[name] || "").trim());

const buildChecks = () => {
  const aiProvider = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  const embeddingProvider = String(process.env.EMBEDDING_PROVIDER || "")
    .trim()
    .toLowerCase();
  const checks = [];

  checks.push({
    name: "AI_PROVIDER is set explicitly",
    // Defaulting is what hid the original fault: code defaults to
    // "gemini" in one place and "" in another, so an unset value took
    // different branches and produced a contradictory error.
    ok: aiProvider === "gemini" || aiProvider === "openai",
    detail: aiProvider ? `AI_PROVIDER=${aiProvider}` : "AI_PROVIDER is unset",
    remedy: "Set AI_PROVIDER to gemini or openai in the workflow env.",
  });

  checks.push({
    name: "EMBEDDING_PROVIDER is set explicitly",
    ok: embeddingProvider === "gemini" || embeddingProvider === "openai",
    detail: embeddingProvider
      ? `EMBEDDING_PROVIDER=${embeddingProvider}`
      : "EMBEDDING_PROVIDER is unset",
    remedy: "Set EMBEDDING_PROVIDER to match the production backend.",
  });

  if (aiProvider === "gemini") {
    checks.push({
      name: "GEMINI_API_KEY is available for the Gemini path",
      ok: present("GEMINI_API_KEY"),
      detail: present("GEMINI_API_KEY") ? "present" : "MISSING",
      remedy:
        "Add the GEMINI_API_KEY repository secret. Without it OCR silently " +
        "falls through to the OpenAI branch and fails on every scanned PDF.",
    });
  }
  if (aiProvider === "openai" || embeddingProvider === "openai") {
    checks.push({
      name: "OPENAI_API_KEY is available for the OpenAI path",
      ok: present("OPENAI_API_KEY"),
      detail: present("OPENAI_API_KEY") ? "present" : "MISSING",
      remedy: "Add the OPENAI_API_KEY repository secret.",
    });
  }
  if (embeddingProvider === "gemini") {
    checks.push({
      name: "GEMINI_API_KEY is available for embeddings",
      ok: present("GEMINI_API_KEY"),
      detail: present("GEMINI_API_KEY") ? "present" : "MISSING",
      remedy:
        "EMBEDDING_PROVIDER=gemini without GEMINI_API_KEY produces zero " +
        "embeddings while appearing to run normally.",
    });
  }

  checks.push({
    name: "PINECONE_API_KEY is available",
    ok: present("PINECONE_API_KEY"),
    detail: present("PINECONE_API_KEY") ? "present" : "MISSING",
    remedy: "Add the PINECONE_API_KEY repository secret.",
  });

  // The namespace must be pinned, not derived. VECTOR_NAMESPACE falls
  // back to `${EMBEDDING_MODEL}-${DIM}-v1`, so an unpinned namespace here
  // silently diverges from the API's namespace whenever the workflow's
  // embedding model differs — writing vectors production never reads.
  checks.push({
    name: "PINECONE_NAMESPACE is pinned explicitly",
    ok: present("PINECONE_NAMESPACE"),
    detail: present("PINECONE_NAMESPACE") ? "present" : "MISSING",
    remedy:
      "Add the PINECONE_NAMESPACE repository secret, using the same value " +
      "as the production backend, so written vectors are readable by it.",
  });

  return checks;
};

const main = () => {
  const checks = buildChecks();
  const failed = checks.filter((check) => !check.ok);

  for (const check of checks) {
    console.log(`${check.ok ? "OK  " : "FAIL"}  ${check.name} (${check.detail})`);
  }

  if (failed.length === 0) {
    console.log("\nProcessing configuration is valid; safe to dequeue jobs.");
    return;
  }

  console.error(
    `\n${failed.length} configuration problem(s). Refusing to start processing.\n` +
      "No jobs were dequeued and no document state was modified.\n",
  );
  for (const check of failed) console.error(`  - ${check.name}: ${check.remedy}`);
  process.exitCode = 1;
};

if (require.main === module) main();

module.exports = { buildChecks };
