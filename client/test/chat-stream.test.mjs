import test from "node:test";
import assert from "node:assert/strict";
import { streamEventText } from "../src/lib/chat-stream.js";

test("policy draft SSE content remains readable across provider chunk shapes", () => {
  assert.equal(streamEventText("Draft "), "Draft ");
  assert.equal(streamEventText({ text: "from Gemini" }), "from Gemini");
  assert.equal(streamEventText({ delta: " progressively" }), " progressively");
  assert.equal(streamEventText({ object: "not text" }), "");
});
