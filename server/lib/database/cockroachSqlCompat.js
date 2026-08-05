// CockroachDB SQL compatibility transforms.
//
// Rewrites PostgreSQL migration SQL into CockroachDB-accepted SQL. This
// exists so the PostgreSQL/Neon migrations stay byte-for-byte unchanged —
// the transform is applied only when the target dialect is cockroach.
//
// Every transform declares whether it is SEMANTICS-PRESERVING or
// SEMANTICS-CHANGING. A semantics-changing transform is not a fix; it is a
// finding that needs a design decision, and it is reported as such rather
// than silently papering over the difference.

const TRANSFORMS = [
  {
    id: "with-no-data",
    // PostgreSQL: CREATE TABLE t AS SELECT ... WITH NO DATA
    // CockroachDB: unimplemented. LIMIT 0 produces an identical empty
    // table with the same column types, and composes with an existing
    // WHERE clause (unlike appending WHERE false).
    semantics: "preserving",
    reason:
      "CREATE TABLE AS ... WITH NO DATA is unimplemented in CockroachDB; " +
      "LIMIT 0 creates the same empty table with the same column types.",
    apply: (sql) => sql.replace(/\bWITH\s+NO\s+DATA\b/gi, "LIMIT 0"),
    detect: (sql) => /\bWITH\s+NO\s+DATA\b/i.test(sql),
  },
  {
    id: "deferrable-fk",
    // PostgreSQL: ... DEFERRABLE INITIALLY DEFERRED
    // CockroachDB: deferrable foreign keys are not supported.
    //
    // THIS CHANGES BEHAVIOR. In this schema the deferral is not cosmetic:
    // documents.primary_pdf_resource_id references document_resources,
    // while document_resources references documents — a genuine cycle.
    // Deferred checking is what allows both sides to be written inside one
    // transaction regardless of order. With immediate checking, any code
    // path that writes the two out of order will fail at runtime, not at
    // migration time, so a clean migration here does NOT mean the
    // application works.
    semantics: "changing",
    reason:
      "CockroachDB does not support DEFERRABLE foreign keys. Removing the " +
      "clause makes FK checks immediate. The documents <-> document_resources " +
      "cycle relies on deferral, so insert ordering in the dual-write path " +
      "must be redesigned before this is safe.",
    apply: (sql) =>
      sql.replace(/\s+DEFERRABLE\s+INITIALLY\s+DEFERRED\b/gi, ""),
    detect: (sql) => /\bDEFERRABLE\s+INITIALLY\s+DEFERRED\b/i.test(sql),
  },
];

/**
 * Apply all Cockroach transforms to a SQL string.
 * Returns the rewritten SQL plus the list of transforms that fired, so the
 * caller can surface semantics-changing rewrites instead of hiding them.
 */
const toCockroachSql = (sql) => {
  let output = String(sql);
  const applied = [];
  for (const transform of TRANSFORMS) {
    if (!transform.detect(output)) continue;
    output = transform.apply(output);
    applied.push({
      id: transform.id,
      semantics: transform.semantics,
      reason: transform.reason,
    });
  }
  return { sql: output, applied };
};

const hasSemanticChange = (applied) =>
  applied.some((entry) => entry.semantics === "changing");

module.exports = { TRANSFORMS, hasSemanticChange, toCockroachSql };
