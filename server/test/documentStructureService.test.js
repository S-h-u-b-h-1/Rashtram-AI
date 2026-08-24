const test = require("node:test");
const assert = require("node:assert/strict");
const { buildDocumentTree, structurePath, validStructuralTitle } = require("../document/documentStructureService");

test("deterministic structure follows declared part, chapter and section metadata", () => {
  const row = { metadata_json: { sectionPath: ["Part II", "Chapter 4", "Section 12"] } };
  assert.deepEqual(structurePath(row), ["Part II", "Chapter 4", "Section 12"]);
});

test("document tree keeps original chunk indexes as final evidence", () => {
  const nodes = buildDocumentTree({
    document: { id: 7, title: "Sample Act" },
    chunks: [
      { chunk_index: 0, original_text: "Definitions evidence", metadata_json: { sectionPath: ["Part I", "Section 2"], pageStart: 1 } },
      { chunk_index: 1, original_text: "Duties evidence", metadata_json: { sectionPath: ["Part II", "Section 8"], pageStart: 4 } },
    ],
  });
  const root = nodes.find((node) => node.nodeType === "document");
  assert.deepEqual(root.sourceChunkIds, [0, 1]);
  assert.ok(nodes.some((node) => node.title === "Section 8" && node.sourceChunkIds.includes(1)));
  assert.ok(nodes.every((node) => node.summary.length <= 1_000));
});

test("unstructured documents receive bounded passage groups rather than invented sections", () => {
  const nodes = buildDocumentTree({
    document: { id: 8, title: "Unstructured report" },
    chunks: Array.from({ length: 30 }, (_, index) => ({
      chunk_index: index, original_text: `Evidence passage ${index}`, metadata_json: {},
    })),
  });
  assert.ok(nodes.some((node) => /^Passages /.test(node.title)));
  assert.ok(nodes.length < 10);
});

test("noisy parser fragments cannot become structural headings", () => {
  for (const value of ["(x)", "3", "part of any", "section of"]) {
    assert.equal(validStructuralTitle(value), false);
  }
  for (const value of ["Part II", "Chapter 4", "Section 12", "Implementation framework"]) {
    assert.equal(validStructuralTitle(value), true);
  }
});
