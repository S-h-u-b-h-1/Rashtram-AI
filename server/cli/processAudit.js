require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const {
  runReadinessAudit,
  runReadinessReconciliation,
} = require("../document/readinessService");

const parseArguments = (argv = process.argv) => {
  const args = argv.slice(2);
  const unsupported = args.filter((argument) => argument !== "--apply");
  if (unsupported.length) {
    throw new Error(
      `Unsupported process:audit argument: ${unsupported.join(", ")}. ` +
      "Use the exact --apply flag only when reconciliation is intended.",
    );
  }
  return { apply: args.includes("--apply") };
};

const main = async (argv = process.argv) => {
  const { apply } = parseArguments(argv);
  return apply
    ? runReadinessReconciliation()
    : runReadinessAudit();
};

if (require.main === module) {
  main()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error("Readiness audit failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (globalThis.__rashtramPostgresPool) await getPool().end();
    });
}

module.exports = { main, parseArguments };
