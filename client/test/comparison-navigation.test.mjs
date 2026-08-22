import test from "node:test";
import assert from "node:assert/strict";
import { comparisonHrefForDocuments } from "../src/lib/comparison-navigation.mjs";

test("comparison navigation starts only after two unique documents are selected", () => {
  assert.equal(comparisonHrefForDocuments([]), null);
  assert.equal(comparisonHrefForDocuments([{ id: 12 }]), null);
  assert.equal(
    comparisonHrefForDocuments([{ id: 12 }, { id: "34" }]),
    "/app/compare?ids=12%2C34",
  );
  assert.equal(
    comparisonHrefForDocuments([{ id: 12 }, { id: "12" }]),
    null,
  );
});
