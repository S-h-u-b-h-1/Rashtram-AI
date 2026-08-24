const test = require("node:test");
const assert = require("node:assert/strict");
const { streamChunkText } = require("../lib/generationStream");

test("generation stream text never stringifies provider objects", () => {
  assert.equal(streamChunkText("Draft "), "Draft ");
  assert.equal(streamChunkText({ text: "from Gemini" }), "from Gemini");
  assert.equal(streamChunkText({ delta: " progressively" }), " progressively");
  assert.equal(streamChunkText({ text: () => "complete" }), "complete");
  assert.equal(streamChunkText({ candidate: "ignored" }), "");
});
