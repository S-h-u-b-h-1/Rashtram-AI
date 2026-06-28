const crypto = require("crypto");
const express = require("express");
const {
  connectorByName,
} = require("../lib/ingestion/connectors");
const {
  runIngestion,
} = require("../lib/ingestion/core/ingestionRunner");
const {
  getUniversalStats,
  repairCrossTypeIndiaCodeMerges,
} = require("../lib/ingestion/core/catalogRepository");

const router = express.Router();
const OPERATIONAL_SOURCES = new Set(["india-code", "egazette"]);

const secureEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const configuredIngestionSecrets = () => {
  if (process.env.CATALOG_INGESTION_SECRET) {
    return [process.env.CATALOG_INGESTION_SECRET];
  }
  return [process.env.JWT_SECRET, process.env.DATABASE_URL]
    .filter(Boolean)
    .map((secret) =>
      crypto
        .createHmac("sha256", secret)
        .update("rashtram-catalog-ingestion-v1")
        .digest("hex"),
    );
};

const requireIngestionSecret = (req, res, next) => {
  const configured = configuredIngestionSecrets();
  const supplied =
    req.get("x-catalog-ingestion-secret") ||
    req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (
    !configured.length ||
    !configured.some((secret) => secureEqual(secret, supplied))
  ) {
    return res.status(404).json({ error: "Not found" });
  }
  return next();
};

router.use(requireIngestionSecret);

router.post("/refresh", async (req, res, next) => {
  try {
    const requestedSources = Array.isArray(req.body?.sources)
      ? req.body.sources
      : ["india-code", "egazette"];
    const sources = [...new Set(requestedSources)].filter((source) =>
      OPERATIONAL_SOURCES.has(source),
    );
    if (!sources.length || sources.length !== requestedSources.length) {
      return res.status(400).json({
        error: `Allowed sources: ${[...OPERATIONAL_SOURCES].join(", ")}`,
      });
    }

    const limit = Math.min(
      25,
      Math.max(1, Number.parseInt(req.body?.limit, 10) || 10),
    );
    const options = {
      collection: req.body?.collection,
      years: req.body?.years || new Date().getFullYear(),
      catalogOnly: req.body?.catalogOnly === true,
      delayMs: Math.max(150, Number(req.body?.delayMs) || 500),
      maxPages: Math.min(
        5,
        Math.max(1, Number.parseInt(req.body?.maxPages, 10) || 1),
      ),
      limit,
    };

    const summaries = [];
    for (const source of sources) {
      summaries.push(
        await runIngestion(connectorByName(source), {
          ...options,
          collection:
            source === "india-code"
              ? options.collection || "central-acts"
              : "recent",
        }),
      );
    }
    return res.json({ summaries });
  } catch (error) {
    return next(error);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    return res.json(await getUniversalStats());
  } catch (error) {
    return next(error);
  }
});

router.post("/repair-cross-type-merges", async (req, res, next) => {
  try {
    const repairs = await repairCrossTypeIndiaCodeMerges();
    return res.json({ repaired: repairs.length, repairs });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
