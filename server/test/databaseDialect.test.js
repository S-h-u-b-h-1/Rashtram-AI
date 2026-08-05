const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertCockroachTarget,
  getDialect,
  isCockroachTarget,
  maskConnectionString,
} = require("../lib/database/dialect");

const withEnv = (values, run) => {
  const saved = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("defaults to postgres when DATABASE_DIALECT is unset", () => {
  withEnv({ DATABASE_DIALECT: undefined }, () => {
    assert.equal(getDialect(), "postgres");
    assert.equal(isCockroachTarget(), false);
  });
});

test("cockroach-only actions refuse to run on the default (postgres) target", () => {
  withEnv({ DATABASE_DIALECT: undefined }, () => {
    assert.throws(
      () => assertCockroachTarget("cockroach migration"),
      /Refusing to run cockroach migration/,
      "the guard must fail closed so Cockroach DDL can never hit Neon by default",
    );
  });
});

test("cockroach-only actions refuse to run when explicitly targeting postgres", () => {
  withEnv({ DATABASE_DIALECT: "postgres" }, () => {
    assert.throws(() => assertCockroachTarget("destructive test"), /not "cockroach"/);
  });
});

test("cockroach-only actions proceed only on an explicit cockroach target", () => {
  withEnv({ DATABASE_DIALECT: "cockroach" }, () => {
    assert.equal(isCockroachTarget(), true);
    assert.doesNotThrow(() => assertCockroachTarget("cockroach migration"));
  });
});

test("an unknown dialect is rejected rather than silently treated as postgres", () => {
  withEnv({ DATABASE_DIALECT: "mysql" }, () => {
    assert.throws(() => getDialect(), /Unknown DATABASE_DIALECT/);
  });
});

test("dialect matching is case-insensitive and whitespace-tolerant", () => {
  withEnv({ DATABASE_DIALECT: "  CockroachDB ".replace("DB", "") }, () => {
    assert.equal(getDialect(), "cockroach");
  });
});

test("connection strings are masked to host+database, never credentials", () => {
  const masked = maskConnectionString(
    "postgresql://someuser:sup3rs3cret@example.gcp-asia-south1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full",
  );
  assert.ok(!masked.includes("sup3rs3cret"), "password must never appear");
  assert.ok(!masked.includes("someuser"), "username must never appear");
  assert.ok(!masked.includes("sslmode"), "query params must not be echoed");
  assert.match(masked, /cockroachlabs\.cloud\/defaultdb$/);
});

test("masking never throws on an unparseable value", () => {
  assert.doesNotThrow(() => maskConnectionString("not-a-url"));
  assert.ok(!maskConnectionString("not-a-url").includes("not-a-url"));
});
