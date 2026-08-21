#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { argumentValue } = require("./cliArgs");
const { buildReviewPack, validateReviewPack } = require("../evaluation/benchmarkReview");

const resolveInput = (value) => {
  const requested = path.resolve(process.cwd(), value);
  if (fs.existsSync(requested)) return requested;
  return path.resolve(__dirname, "..", String(value).replace(/^server\//, ""));
};
const readJson = (value) => JSON.parse(fs.readFileSync(resolveInput(value), "utf8"));

const main = () => {
  const reviewInput = argumentValue("input-review");
  if (reviewInput) {
    const result = validateReviewPack(readJson(reviewInput));
    console.log(JSON.stringify({ ...result, reviewed: undefined }, null, 2));
    return;
  }
  const benchmark = argumentValue("benchmark");
  const run = argumentValue("run");
  if (!benchmark || !run) {
    throw new Error("Use --benchmark=<cases.json> --run=<run.json> [--output=<review.json>] or --input-review=<review.json>.");
  }
  const pack = buildReviewPack({
    cases: readJson(benchmark),
    run: readJson(run),
    benchmarkVersion: argumentValue("benchmark-version", "v1"),
  });
  const output = argumentValue("output");
  if (output) {
    fs.writeFileSync(path.resolve(process.cwd(), output), `${JSON.stringify(pack, null, 2)}\n`);
    console.log(JSON.stringify({ output, cases: pack.cases.length, format: pack.format }, null, 2));
    return;
  }
  console.log(JSON.stringify(pack, null, 2));
};

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
