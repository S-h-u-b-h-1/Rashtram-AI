import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("document chat generation owns one durable turn instead of client-side duplicate saves", () => {
  const layout = read("components/document-chat/DocumentChatLayout.jsx");
  const submitStart = layout.indexOf("const submitQuestion = async");
  const regenerateStart = layout.indexOf("const regenerate =", submitStart);
  const submitQuestion = layout.slice(submitStart, regenerateStart);

  assert.match(submitQuestion, /requestId:\s*streamId/);
  assert.match(submitQuestion, /conversationEpoch/);
  assert.match(submitQuestion, /failedTurnRef\.current\s*=\s*\{/);
  assert.match(submitQuestion, /retryTurn\?\.requestId/);
  assert.match(submitQuestion, /id:\s*`\$\{streamId\}:user`/);
  assert.match(submitQuestion, /sendDocumentChatMessage\(\{/);
  assert.doesNotMatch(
    submitQuestion,
    /addDocumentChatMessage\(/,
    "the generation route persists the user and assistant messages as one lifecycle",
  );
  assert.match(submitQuestion, /durable chat history|could not be confirmed/i);
});

test("document chat API requires persistence acknowledgement and invalidates stale history", () => {
  const api = read("lib/api.js");
  const sendStart = api.indexOf("export const sendDocumentChatMessage");
  const downloadStart = api.indexOf("const downloadAuthenticatedFile", sendStart);
  const sendDocumentChatMessage = api.slice(sendStart, downloadStart);

  assert.match(sendDocumentChatMessage, /requestId/);
  assert.match(sendDocumentChatMessage, /conversationEpoch/);
  assert.match(sendDocumentChatMessage, /metadata\.persistence\?\.saved !== true/);
  assert.match(sendDocumentChatMessage, /clearApiCache\(\)/);
  assert.match(
    sendDocumentChatMessage,
    /durable chat history could not be confirmed/i,
  );
});

test("clear is blocked during generation and advances the server conversation epoch", () => {
  const layout = read("components/document-chat/DocumentChatLayout.jsx");
  const clearStart = layout.indexOf("const clear = async");
  const stopStart = layout.indexOf("const stopGeneration", clearStart);
  const clearFlow = layout.slice(clearStart, stopStart);
  const input = read("components/document-chat/ChatInput.jsx");

  assert.match(clearFlow, /if \(sending\) return/);
  assert.match(clearFlow, /response\.chat\?\.conversationEpoch/);
  assert.match(input, /onClick=\{onClear\}[\s\S]*disabled=\{sending\}/);
});
