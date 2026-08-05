const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyFailure, runAudit } = require("../cli/cockroachMigrationAudit");

const withEnv = async (values, run) => {
  const saved = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("the audit refuses to run unless the target is explicitly cockroach", async () => {
  await withEnv({ DATABASE_DIALECT: "postgres" }, async () => {
    await assert.rejects(
      () => runAudit({ dryRun: true }),
      /Refusing to run the CockroachDB migration audit/,
      "must fail closed so a Cockroach audit can never touch Neon",
    );
  });

  await withEnv({ DATABASE_DIALECT: undefined }, async () => {
    await assert.rejects(
      () => runAudit({ dryRun: true }),
      /Refusing to run/,
      "an unset dialect must also refuse, not default into Cockroach",
    );
  });
});

test("a cockroach target without a URL fails with a clear, secret-free message", async () => {
  await withEnv(
    { DATABASE_DIALECT: "cockroach", COCKROACH_DATABASE_URL: undefined },
    async () => {
      await assert.rejects(
        () => runAudit({ dryRun: true }),
        /COCKROACH_DATABASE_URL is required/,
      );
    },
  );
});

test("dry-run enumerates migrations in order without connecting", async () => {
  await withEnv(
    {
      DATABASE_DIALECT: "cockroach",
      COCKROACH_DATABASE_URL:
        "postgresql://u:p@unreachable.invalid:26257/defaultdb?sslmode=verify-full",
    },
    async () => {
      const report = await runAudit({ dryRun: true });
      assert.equal(report.mode, "dry_run");
      assert.ok(report.migrationCount > 20, "should enumerate the full migration set");
      // Order matters: migrations are not independent.
      assert.equal(report.migrations[0].order, 1);
      assert.match(report.migrations[0].name, /^001_/);
      const orders = report.migrations.map((m) => m.order);
      assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
      // The target must be masked even in a normal report.
      assert.ok(!report.target.includes("p@"), "credentials must never appear");
      assert.ok(!report.target.includes("sslmode"), "query params must not appear");
    },
  );
});

test("failures are classified by cause so the report drives the right remediation", () => {
  // Feature genuinely absent -> needs a compatibility layer.
  assert.equal(
    classifyFailure({ code: "0A000", message: "unimplemented: CREATE TRIGGER" })
      .classification,
    "unsupported",
  );
  assert.equal(
    classifyFailure({ code: "42883", message: "unknown function: to_tsvector()" })
      .classification,
    "unsupported",
  );
  // Dialect syntax -> needs a rewritten statement.
  assert.equal(
    classifyFailure({ code: "42601", message: "syntax error at or near GENERATED" })
      .classification,
    "rewrite_required",
  );
  // Missing object -> almost always a cascade from an earlier failure, and
  // must NOT be counted as an independent incompatibility.
  assert.equal(
    classifyFailure({ code: "42P01", message: 'relation "documents" does not exist' })
      .classification,
    "blocked",
  );
  // Unknown -> reported honestly rather than force-fitted into a bucket.
  assert.equal(
    classifyFailure({ code: "XX000", message: "internal error" }).classification,
    "failed",
  );
  // Every classification carries actionable remediation text.
  for (const sample of [
    { code: "0A000", message: "unimplemented" },
    { code: "42601", message: "syntax error" },
    { code: "42P01", message: "does not exist" },
    { code: "XX000", message: "boom" },
  ]) {
    assert.ok(
      classifyFailure(sample).remediation.length > 20,
      "each classification must explain what to do next",
    );
  }
});
