import test from "node:test";
import assert from "node:assert/strict";

import {
  canPrepareDocumentForResearch,
  documentCapabilities,
  documentReadinessClass,
  isComparisonReady,
  isResearchReady,
  isSourceOnlyResearchDocument,
} from "../src/lib/document-readiness.js";

test("HTML search/chat readiness does not require a PDF", () => {
  const document = {
    id: "html-1",
    sourceName: "policy-edge",
    sourceUrl: "https://www.policyedge.in/p/example",
    pdfUrl: null,
    readinessClass: "comparison_ready",
    capabilities: {
      resourceReady: true,
      textReady: true,
      searchReady: true,
      semanticReady: false,
      chatReady: true,
      comparisonReady: true,
    },
  };
  assert.equal(isResearchReady(document), true);
  assert.equal(isComparisonReady(document), true);
  assert.equal(documentReadinessClass(document), "research_ready");
  assert.equal(isSourceOnlyResearchDocument(document), false);
  assert.equal(canPrepareDocumentForResearch(document), false);
});

test("search readiness remains distinct from semantic and chat readiness", () => {
  const capabilities = documentCapabilities({
    capabilities: {
      resourceReady: true,
      textReady: true,
      searchReady: true,
      semanticReady: false,
      chatReady: false,
      comparisonReady: true,
    },
  });
  assert.equal(capabilities.searchReady, true);
  assert.equal(capabilities.semanticReady, false);
  assert.equal(capabilities.chatReady, false);
  assert.equal(capabilities.comparisonReady, false);
});

test("non-ready source-only document stays unavailable", () => {
  const document = {
    sourceUrl: "https://example.test/source",
    pdfUrl: null,
    readinessClass: "source_only",
    capabilities: {
      resourceReady: false,
      textReady: false,
      searchReady: false,
      semanticReady: false,
      chatReady: false,
      comparisonReady: false,
    },
  };
  assert.equal(isResearchReady(document), false);
  assert.equal(isSourceOnlyResearchDocument(document), true);
});
