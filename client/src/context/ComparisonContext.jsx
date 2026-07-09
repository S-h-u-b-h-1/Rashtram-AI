"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getDocumentReadiness, prepareDocumentForComparison } from "@/lib/api";

const STORAGE_KEY = "rashtram-comparison-documents";
const ComparisonContext = createContext(null);

export const comparisonDisabledReason = (document) => {
  if (!document?.id || !document?.title) return "Research workspace unavailable";
  if (document.comparisonReady) return "";
  if (
    document.processingStatus === "failed" ||
    document.extractionStatus === "failed" ||
    document.embeddingStatus === "failed"
  ) {
    return document.readinessReason || document.failureReason || "Processing failed";
  }
  if (
    document.readinessClass === "source_extractable_not_processed" ||
    document.readiness === "source_extractable_not_processed"
  ) {
    return "Prepare for Research before comparing";
  }
  if (!document.hasAccessibleResource && !document?.pdfUrl) {
    return "PDF unavailable";
  }
  if (document.extractionStatus && document.extractionStatus !== "ready") {
    return "Text extraction pending";
  }
  if (
    document.extractionStatus === "ready" &&
    Number(document.chunksCount || 0) <= 0
  ) {
    return "No extractable text found";
  }
  if (!document.researchReady) return "Research workspace unavailable";
  if (document.comparisonReady === false) {
    return document.readinessReason || "Comparison retrieval is unavailable";
  }
  return "";
};

export const canPrepareForResearch = (document) => {
  if (!document || document.researchReady) return false;
  const readiness = document.readinessClass || document.readiness || "";
  if (
    [
      "pdf_available",
      "pdf_available_not_processed",
      "source_extractable_not_processed",
      "processing_failed_retriable",
      "ocr_required",
    ].includes(readiness)
  ) {
    return true;
  }
  return Boolean(document.pdfUrl) || (
    (document.type === "policy" || document.documentType === "policy") &&
    String(document.sourceName || document.source || "").toLowerCase().includes("policyedge") &&
    Boolean(document.sourceUrl)
  );
};

export function ComparisonProvider({ children }) {
  const [documents, setDocuments] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setDocuments(saved.slice(0, 5));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    }
  }, [documents, hydrated]);

  const value = useMemo(
    () => {
      const addPreparedDocument = (document) => {
        const reason = comparisonDisabledReason(document);
        if (reason) return { ok: false, reason };
        if (documents.some((item) => String(item.id) === String(document.id))) {
          return { ok: true };
        }
        if (documents.length >= 5) {
          return { ok: false, reason: "You can compare up to five documents." };
        }
        setDocuments((current) => [
          ...current,
          {
            id: String(document.id),
            title: document.title,
            type: document.type || document.documentType,
            documentType: document.type || document.documentType,
            ministry: document.ministry || null,
            authority: document.authority || null,
            state: document.state || null,
            jurisdiction: document.jurisdiction || null,
            year: document.year || null,
            publicationDate: document.publicationDate || null,
            pdfUrl: document.pdfUrl,
            processingStatus: document.processingStatus,
            extractionStatus: document.extractionStatus,
            embeddingStatus: document.embeddingStatus,
            chunksCount: document.chunksCount,
            hasAccessibleResource: document.hasAccessibleResource,
            researchReady: true,
            comparisonReady: true,
          },
        ]);
        return { ok: true };
      };
      return {
        documents,
        isSelected: (id) =>
          documents.some((document) => String(document.id) === String(id)),
        addDocument: addPreparedDocument,
        prepareAndAddDocument: async (document) => {
          if (!document?.id) {
            return { ok: false, reason: "Document not found." };
          }
          const prepared = await prepareDocumentForComparison(document.id);
          const readiness =
            prepared.readiness || await getDocumentReadiness(document.id);
          if (!readiness?.comparisonReady) {
            return {
              ok: false,
              reason:
                readiness?.reason ||
                readiness?.readinessReason ||
                "Document could not be prepared for comparison.",
              readiness,
            };
          }
          return addPreparedDocument({
            ...document,
            researchReady: true,
            comparisonReady: true,
            processingStatus: "ready",
            extractionStatus: "ready",
            embeddingStatus:
              readiness.embeddingStatus || document.embeddingStatus,
            chunksCount: readiness.counts?.chunks || document.chunksCount,
            embeddingsCount:
              readiness.counts?.embeddings || document.embeddingsCount,
            retrievalMode: readiness.retrievalMode,
            hasAccessibleResource:
              readiness.requirements?.hasAccessibleResource ??
              document.hasAccessibleResource,
          });
        },
        removeDocument: (id) =>
          setDocuments((current) =>
            current.filter((document) => String(document.id) !== String(id)),
          ),
        clear: () => setDocuments([]),
      };
    },
    [documents],
  );

  return (
    <ComparisonContext.Provider value={value}>
      {children}
    </ComparisonContext.Provider>
  );
}

export const useComparison = () => {
  const value = useContext(ComparisonContext);
  if (!value) {
    throw new Error("useComparison must be used within ComparisonProvider.");
  }
  return value;
};
