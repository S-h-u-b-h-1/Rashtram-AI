#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { getPool } = require("../db");
const { argumentFlag, argumentValue } = require("./cliArgs");
const {
  auditSemanticVectorState,
  deleteSafeOrphanVectors,
  reconcileSemanticReadinessTruth,
  repairSemanticVectorState,
  semanticReadinessTruth,
  summarizeSemanticReadinessTruth,
} = require("../document/semanticReconciliationService");

const boundedAuditReport = (audit, { includeSamples = true } = {}) => ({
  activeNamespace: audit.activeNamespace,
  postgresNamespaceReferences: audit.postgresNamespaceReferences,
  postgresRoutingReferences: audit.postgresRoutingReferences,
  pinecone: audit.pinecone,
  referenceDelta: audit.referenceDelta,
  diagnostics: audit.diagnostics,
  ...(includeSamples ? { diagnosticSamples: audit.diagnosticSamples } : {}),
  missingCount: audit.missing.length,
  ...(includeSamples ? { missingSample: audit.missing.slice(0, 20) } : {}),
  missingDocumentCount: audit.missingByDocument.length,
  metadataRepairCount: audit.metadataRepairs.length,
  ...(includeSamples ? { metadataRepairSample: audit.metadataRepairs.slice(0, 20) } : {}),
  metadataRepairDocumentCount: audit.metadataRepairsByDocument.length,
  deferredVectorOnlyCount: audit.deferredVectorOnly.length,
  ...(includeSamples ? { deferredVectorOnlySample: audit.deferredVectorOnly.slice(0, 20) } : {}),
  deferredDocumentCount: audit.deferredByDocument.length,
  safeOrphanCount: audit.safeOrphans.length,
  ...(includeSamples ? { safeOrphanSample: audit.safeOrphans.slice(0, 20) } : {}),
  unexplainedVectorOnlyCount: audit.unexplainedVectorOnly.length,
  reconciliationCounts: audit.reconciliationCounts,
  readinessTruth: includeSamples
    ? summarizeSemanticReadinessTruth(semanticReadinessTruth(audit))
    : {
      ...summarizeSemanticReadinessTruth(semanticReadinessTruth(audit)),
      mismatchSample: undefined,
    },
});

const main = async () => {
  const compact = argumentFlag("compact");
  const output = argumentValue("output");
  const emit = (report) => {
    if (output) {
      const outputPath = path.resolve(output);
      fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
      console.log(JSON.stringify({
        mode: report.mode,
        outputPath,
        diagnostics: report.after?.diagnostics || report.diagnostics,
        reconciliationCounts: report.after?.reconciliationCounts || report.reconciliationCounts,
        referenceDelta: report.after?.referenceDelta ?? report.referenceDelta,
        readinessTruth: report.after?.readinessTruth || report.readinessTruth,
        repairs: Array.isArray(report.repairs) ? report.repairs.length : 0,
        deletedSafeOrphans: Array.isArray(report.deletedSafeOrphans)
          ? report.deletedSafeOrphans.length : 0,
      }, null, 2));
      return;
    }
    console.log(JSON.stringify(report, null, 2));
  };
  const before = await auditSemanticVectorState();
  const publicReport = boundedAuditReport(before, { includeSamples: !compact });
  const repairVectors = argumentFlag("repair");
  const repairReadiness = argumentFlag("repair-readiness");
  const deleteSafeOrphans = argumentFlag("delete-safe-orphans");
  if (!repairVectors && !repairReadiness && !deleteSafeOrphans) {
    emit({ mode: "audit", ...publicReport });
    return;
  }
  const repairs = repairVectors
    ? await repairSemanticVectorState({ audit: before })
    : [];
  const readinessAudit = repairReadiness && repairVectors
    ? await auditSemanticVectorState()
    : before;
  const readinessRepair = repairReadiness
    ? await reconcileSemanticReadinessTruth({ audit: readinessAudit })
    : null;
  const deletedSafeOrphans = deleteSafeOrphans
    ? await deleteSafeOrphanVectors({ audit: before })
    : [];
  const after = await auditSemanticVectorState();
  emit({
    mode: repairVectors && repairReadiness
      ? "repair_vectors_and_readiness"
      : repairVectors ? "repair_vectors"
        : repairReadiness ? "repair_readiness" : "delete_safe_orphans",
    before: publicReport,
    repairs,
    deletedSafeOrphans,
    readinessRepair: readinessRepair ? {
      before: summarizeSemanticReadinessTruth(readinessRepair.before),
      updates: readinessRepair.updates.length,
      updateSample: readinessRepair.updates.slice(0, 20),
    } : null,
    after: {
      ...boundedAuditReport(after, { includeSamples: !compact }),
    },
  });
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => getPool().end());
