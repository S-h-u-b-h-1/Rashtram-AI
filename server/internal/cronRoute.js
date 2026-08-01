const crypto = require("crypto");
const express = require("express");
const { connectorByName } = require("../lib/ingestion/connectors");
const { runIngestion } = require("../lib/ingestion/core/ingestionRunner");
const {
  BOUNDED_CRON_SOURCES,
} = require("../lib/ingestion/schedules");
const { refreshDataQuality } = require("../lib/database/quality");
const { getPool } = require("../db");
const { runRetention } = require("../lib/database/maintenance");
const { readStorageStatus } = require("../lib/database/capacity");
const {
  runObjectStorageSmokeTest,
  sanitizedObjectStorageStatus,
} = require("../lib/storage/objectStorage");

const router = express.Router();

const secureEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const authorizeCron = (req, res, next) => {
  const configured = process.env.CRON_SECRET;
  const supplied = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !secureEqual(configured, supplied)) {
    return res.status(404).json({ error: "Not found" });
  }
  return next();
};

const runBoundedCron = async (req, res, next) => {
  try {
    const bodySources = Array.isArray(req.body?.sources)
      ? req.body.sources
      : null;
    const requested = bodySources || [
      String(req.query.source || BOUNDED_CRON_SOURCES[0]),
    ];
    const sources = [...new Set(requested)].filter((source) =>
      BOUNDED_CRON_SOURCES.includes(source),
    );
    if (!sources.length || sources.length !== requested.length) {
      return res.status(400).json({
        error: `Allowed sources: ${BOUNDED_CRON_SOURCES.join(", ")}`,
      });
    }
    if (sources.length > 3) {
      return res.status(400).json({ error: "At most three sources per run." });
    }

    const summaries = [];
    for (const source of sources) {
      summaries.push(
        await runIngestion(connectorByName(source), {
          maxPages: Math.min(2, Math.max(1, Number(req.body?.maxPages || 1))),
          limit: Math.min(25, Math.max(1, Number(req.body?.limit || 10))),
          delayMs: Math.max(250, Number(req.body?.delayMs || 500)),
          timeoutMs: 12_000,
          retries: 1,
          downloadPdfs: false,
          catalogOnly: true,
        }),
      );
    }
    const quality = await refreshDataQuality();
    return res.json({
      ok: summaries.every((summary) => summary.status !== "failed"),
      summaries,
      quality,
    });
  } catch (error) {
    return next(error);
  }
};

router.use(authorizeCron);
router.get("/ingest", runBoundedCron);
router.post("/ingest", runBoundedCron);
router.get("/maintenance", async (req, res, next) => {
  try {
    const storage = await readStorageStatus(getPool());
    if (storage.alerts.length) {
      const details = {
        level: storage.level,
        usagePercent: storage.usagePercent,
        headroomBytes: storage.headroomBytes,
        alerts: storage.alerts,
      };
      if (storage.level === "critical") {
        console.error("Database storage capacity alert", details);
      } else {
        console.warn("Database storage capacity alert", details);
      }
    }
    const retention = await runRetention(getPool(), {
      batchSize: 250,
      maxBatches: 4,
    });
    return res.json({ ok: true, storage, retention });
  } catch (error) {
    return next(error);
  }
});

router.get("/health", async (req, res, next) => {
  try {
    const storage = await readStorageStatus(getPool());
    let objectStorage;
    try {
      const smoke = await runObjectStorageSmokeTest();
      objectStorage = {
        configured: smoke.configured,
        reachable: smoke.reachable,
        readAvailable: smoke.readAvailable,
        writeAvailable: smoke.writeAvailable,
        providerName: smoke.providerName,
      };
    } catch (error) {
      objectStorage = error.objectStorageStatus || sanitizedObjectStorageStatus();
    }
    return res.status(storage.level === "critical" ? 503 : 200).json({
      ok: storage.level !== "critical",
      database: "connected",
      storage,
      objectStorage,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
