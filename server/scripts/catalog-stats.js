#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { getCatalogStats } = require("../lib/catalogRepository");
const { getPool } = require("../db");

getCatalogStats()
  .then((stats) => {
    console.log(JSON.stringify(stats, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
