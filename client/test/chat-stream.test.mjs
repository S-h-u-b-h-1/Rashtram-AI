import test from "node:test";
import assert from "node:assert/strict";
import { mergeSSEMeta, streamEventText } from "../src/lib/chat-stream.js";

test("policy draft SSE content remains readable across provider chunk shapes", () => {
  assert.equal(streamEventText("Draft "), "Draft ");
  assert.equal(streamEventText({ text: "from Gemini" }), "from Gemini");
  assert.equal(streamEventText({ delta: " progressively" }), " progressively");
  assert.equal(streamEventText({ object: "not text" }), "");
});

test("later SSE metadata cannot erase citations delivered before completion", () => {
  const first = mergeSSEMeta({}, {
    sources: [{ id: "D1-C1", content: "Grounded passage" }],
    metadata: { retrievalMode: "hybrid" },
  });
  const completed = mergeSSEMeta(first, {
    sources: [],
    metadata: { persisted: true },
  });
  assert.deepEqual(completed.sources, first.sources);
  assert.deepEqual(completed.metadata, {
    retrievalMode: "hybrid",
    persisted: true,
  });
});
