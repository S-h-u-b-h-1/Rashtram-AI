#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { getPool } = require("../db");
const { argumentFlag } = require("./cliArgs");
const {
  auditSemanticVectorState,
  reconcileSemanticReadinessTruth,
  repairSemanticVectorState,
  semanticReadinessTruth,
  summarizeSemanticReadinessTruth,
} = require("../document/semanticReconciliationService");

const boundedAuditReport = (audit) => ({
  activeNamespace: audit.activeNamespace,
  postgresNamespaceReferences: audit.postgresNamespaceReferences,
  pinecone: audit.pinecone,
  missingCount: audit.missing.length,
  missingSample: audit.missing.slice(0, 20),
  missingDocumentCount: audit.missingByDocument.length,
  metadataRepairCount: audit.metadataRepairs.length,
  metadataRepairSample: audit.metadataRepairs.slice(0, 20),
  metadataRepairDocumentCount: audit.metadataRepairsByDocument.length,
  deferredVectorOnlyCount: audit.deferredVectorOnly.length,
  deferredVectorOnlySample: audit.deferredVectorOnly.slice(0, 20),
  deferredDocumentCount: audit.deferredByDocument.length,
  readinessTruth: summarizeSemanticReadinessTruth(semanticReadinessTruth(audit)),
});

const main = async () => {
  const before = await auditSemanticVectorState();
  const publicReport = boundedAuditReport(before);
  const repairVectors = argumentFlag("repair");
  const repairReadiness = argumentFlag("repair-readiness");
  if (!repairVectors && !repairReadiness) {
    console.log(JSON.stringify({ mode: "audit", ...publicReport }, null, 2));
    return;
  }
  const repairs = repairVectors
    ? await repairSemanticVectorState({ audit: before })
    : [];
  const readinessRepair = repairReadiness
    ? await reconcileSemanticReadinessTruth({ audit: before })
    : null;
  const after = await auditSemanticVectorState();
  console.log(JSON.stringify({
    mode: repairVectors && repairReadiness
      ? "repair_vectors_and_readiness"
      : repairVectors ? "repair_vectors" : "repair_readiness",
    before: publicReport,
    repairs,
    readinessRepair: readinessRepair ? {
      before: summarizeSemanticReadinessTruth(readinessRepair.before),
      updates: readinessRepair.updates.length,
      updateSample: readinessRepair.updates.slice(0, 20),
    } : null,
    after: {
      ...boundedAuditReport(after),
    },
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => getPool().end());
