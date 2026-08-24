import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyRegenerationOutcome,
  comparisonActionState,
} from "../src/lib/comparison-regeneration.mjs";

test("an existing comparison exposes an atomic regeneration loading state", () => {
  assert.deepEqual(comparisonActionState({
    hasComparison: true,
    regenerating: true,
    ready: true,
  }), {
    disabled: true,
    label: "Regenerating comparison…",
    preservePreviousResult: true,
  });
  assert.equal(comparisonActionState({
    hasComparison: true,
    ready: true,
  }).label, "Regenerate with AI");
});

test("regeneration success replaces atomically and failure preserves the old comparison", () => {
  const previous = { id: "9", result: { executiveSummary: "Version one" } };
  const next = { id: "9", result: { executiveSummary: "Version two" } };
  assert.equal(applyRegenerationOutcome(previous, { comparison: next }), next);
  assert.equal(applyRegenerationOutcome(previous, null), previous);
});

test("comparison UI uses the dedicated versioned endpoint and a synchronous double-click guard", async () => {
  const source = await readFile(
    new URL("../src/components/documents/DocumentComparison.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /regenerateDocumentComparison\(comparison\.id, payload\)/);
  assert.match(source, /regenerationInFlight\.current/);
  assert.match(source, /Your current comparison will remain visible/);
  assert.doesNotMatch(source, /setComparison\(null\)/);
});
