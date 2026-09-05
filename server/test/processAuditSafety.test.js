const test = require("node:test");
const assert = require("node:assert/strict");

const {
  runReadinessAudit,
  runReadinessReconciliation,
} = require("../document/readinessService");
const { parseArguments } = require("../cli/processAudit");

const fingerprint = (suffix = "stable") => ({
  processingState: { rows: 20, hash: `state-${suffix}` },
  documents: { rows: 20, hash: `documents-${suffix}` },
  legacyDocuments: { rows: 20, hash: `legacy-${suffix}` },
  processingJobs: { rows: 4, hash: `jobs-${suffix}` },
});

test("process audit is read-only and preserves before/after fingerprints", async () => {
  const statements = [];
  const stable = fingerprint();
  const queryFn = async (sql) => {
    statements.push(String(sql));
    if (String(sql).includes("AS fingerprint")) {
      return { rows: [{ fingerprint: stable }] };
    }
    if (String(sql).includes("AS missing_states")) {
      return {
        rows: [{
          documents: 20,
          missing_states: 2,
          document_flag_mismatches: 1,
          dead_letters_eligible: 3,
          unsafe_failure_rows: 0,
          classifications: [
            { classification: "comparison_ready", documents: 8 },
            { classification: "source_only", documents: 12 },
          ],
        }],
      };
    }
    return { rows: [] };
  };

  const result = await runReadinessAudit({ queryFn });

  assert.equal(result.mode, "audit");
  assert.equal(result.readOnly, true);
  assert.deepEqual(result.mutationCounts, {
    created: 0,
    updated: 0,
    deleted: 0,
  });
  assert.deepEqual(result.fingerprint.before, stable);
  assert.deepEqual(result.fingerprint.after, stable);
  assert.equal(result.fingerprint.unchanged, true);
  assert.equal(result.diagnostics.missingStates, 2);
  assert.match(statements[0], /REPEATABLE READ READ ONLY/);
  assert.equal(statements.at(-1), "COMMIT");
  assert.equal(
    statements.some((statement) =>
      /\b(?:INSERT|UPDATE|DELETE|UPSERT|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(
        statement,
      )),
    false,
    "the default audit path must never issue mutating SQL",
  );
});

test("process audit fails closed if its database fingerprint changes", async () => {
  const statements = [];
  let fingerprintReads = 0;
  const queryFn = async (sql) => {
    statements.push(String(sql));
    if (String(sql).includes("AS fingerprint")) {
      fingerprintReads += 1;
      return {
        rows: [{
          fingerprint: fingerprint(fingerprintReads === 1 ? "before" : "after"),
        }],
      };
    }
    if (String(sql).includes("AS missing_states")) {
      return { rows: [{ documents: 20, classifications: [] }] };
    }
    return { rows: [] };
  };

  await assert.rejects(
    runReadinessAudit({ queryFn }),
    /database fingerprint change/i,
  );
  assert.equal(statements.at(-1), "ROLLBACK");
});

test("readiness reconciliation mutates only through the explicit apply path", async () => {
  const statements = [];
  const results = [
    { rows: [{ document_id: 101 }] },
    { rows: [{ readiness_class: "comparison_ready" }] },
    { rows: [] },
    { rows: [] },
    { rows: [{ document_id: 102 }] },
    { rows: [] },
    { rows: [{ id: 7 }] },
    { rows: [{ documents: 42 }] },
  ];
  const queryFn = async (sql) => {
    statements.push(String(sql));
    return results.shift() || { rows: [] };
  };

  const result = await runReadinessReconciliation({ queryFn });

  assert.equal(result.mode, "reconcile");
  assert.equal(result.explicitApply, true);
  assert.equal(result.createdStates, 1);
  assert.equal(result.updatedStates, 1);
  assert.equal(result.reconciledDeadLetters, 1);
  assert.equal(result.sanitizedFailures, 1);
  assert.equal(
    statements.some((statement) => /\bINSERT\b/i.test(statement)),
    true,
  );
  assert.equal(
    statements.some((statement) => /\bUPDATE\b/i.test(statement)),
    true,
  );
});

test("process audit CLI accepts only the exact explicit apply flag", () => {
  assert.deepEqual(parseArguments(["node", "processAudit.js"]), {
    apply: false,
  });
  assert.deepEqual(parseArguments(["node", "processAudit.js", "--apply"]), {
    apply: true,
  });
  assert.throws(
    () => parseArguments(["node", "processAudit.js", "--apply=true"]),
    /Unsupported process:audit argument/,
  );
  assert.throws(
    () => parseArguments(["node", "processAudit.js", "--repair"]),
    /Unsupported process:audit argument/,
  );
});
