import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");

test("workspace navigation uses a mobile and tablet drawer", async () => {
  const source = await read("components/workspace/WorkspaceShell.jsx");
  assert.match(source, /lg:static lg:w-\[280px\] lg:translate-x-0/);
  assert.match(source, /lg:hidden/);
  assert.match(source, /w-\[min\(280px,88vw\)\]/);
});

test("research workspaces share accessible mobile bottom sheets", async () => {
  const [sheet, documentChat, multiChat, drafter] = await Promise.all([
    read("components/workspace/MobileWorkspaceSheet.jsx"),
    read("components/document-chat/DocumentChatLayout.jsx"),
    read("components/documents/MultiDocumentChat.jsx"),
    read("components/policy/PolicyDraftWorkspace.jsx"),
  ]);
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /82dvh/);
  for (const source of [documentChat, multiChat, drafter]) {
    assert.match(source, /MobileWorkspaceSheet/);
  }
});

test("chat composer is safe-area aware and remains pinned on phone", async () => {
  const source = await read("components/document-chat/ChatInput.jsx");
  assert.match(source, /sticky bottom-0/);
  assert.match(source, /safe-area-inset-bottom/);
  assert.match(source, /min-h-9/);
});
