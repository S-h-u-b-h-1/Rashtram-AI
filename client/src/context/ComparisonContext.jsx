"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "rashtram-comparison-documents";
const ComparisonContext = createContext(null);

export const comparisonDisabledReason = (document) => {
  if (document.processingStatus === "failed") return "Processing failed";
  if (!document?.pdfUrl) return "PDF unavailable";
  if (!document.id || !document.title) return "Research workspace unavailable";
  if (!document.researchReady) return "Document not indexed yet";
  return "";
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
    () => ({
      documents,
      isSelected: (id) =>
        documents.some((document) => String(document.id) === String(id)),
      addDocument: (document) => {
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
            pdfUrl: document.pdfUrl,
            processingStatus: document.processingStatus,
            researchReady: true,
          },
        ]);
        return { ok: true };
      },
      removeDocument: (id) =>
        setDocuments((current) =>
          current.filter((document) => String(document.id) !== String(id)),
        ),
      clear: () => setDocuments([]),
    }),
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
