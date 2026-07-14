import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_RECOMMENDATION_GRID_CLASSES,
  compareActionState,
  deduplicateRecommendations,
  recommendationMatchesFilter,
  recommendationResearchHref,
} from "../src/components/recommendations/recommendation-utils.mjs";

const now = Date.parse("2026-07-14T00:00:00.000Z");

test("recommendation filters use only supported document metadata and signals", () => {
  const recommendation = {
    signals: ["sameJurisdiction", "sameYear", "semanticMatch"],
    publicationDate: "2026-01-12T00:00:00.000Z",
    researchReady: true,
  };
  for (const filter of [
    "all",
    "same-jurisdiction",
    "same-year",
    "recent",
    "similar-topic",
    "research-ready",
  ]) {
    assert.equal(recommendationMatchesFilter(recommendation, filter, now), true);
  }
  assert.equal(
    recommendationMatchesFilter(
      { signals: [], publicationDate: "2024-01-01", researchReady: false },
      "recent",
      now,
    ),
    false,
  );
  assert.equal(
    recommendationMatchesFilter({ signals: ["sameMinistry"] }, "same-year", now),
    false,
  );
});

test("deduplication uses canonical document identity, retains versions, and keeps the best duplicate", () => {
  const recommendations = deduplicateRecommendations([
    { id: "document-v1", title: "A Bill", score: 0.3 },
    { id: "document-v1", title: "A Bill", score: 0.7, researchReady: true },
    { id: "document-v2", title: "A Bill", score: 0.4 },
  ]);
  assert.equal(recommendations.length, 2);
  assert.equal(recommendations.find((item) => item.id === "document-v1").score, 0.7);
  assert.ok(recommendations.some((item) => item.id === "document-v2"));
});

test("research and compare actions preserve document navigation and removal behavior", () => {
  assert.equal(
    recommendationResearchHref({ id: "law/2026" }),
    "/app/document/law%2F2026",
  );
  assert.deepEqual(compareActionState("PDF unavailable", false), {
    disabled: true,
    label: "Add to compare",
  });
  assert.deepEqual(compareActionState("PDF unavailable", true), {
    disabled: false,
    label: "Remove compare",
  });
});

test("profile recommendation grid has explicit mobile through wide-desktop columns", () => {
  for (const className of [
    "grid-cols-1",
    "sm:grid-cols-2",
    "xl:grid-cols-3",
    "2xl:grid-cols-4",
  ]) {
    assert.match(PROFILE_RECOMMENDATION_GRID_CLASSES, new RegExp(className.replace(":", "\\:")));
  }
});
