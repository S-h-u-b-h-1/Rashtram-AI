"use client";

import { useSearchParams } from "next/navigation";
import { DocumentChatLayout } from "./DocumentChatLayout";

export function DocumentChatRoute({
  documentType,
  documentId,
  queryKey,
}) {
  const searchParams = useSearchParams();
  let initialDocument = null;
  let resolvedId = documentId;
  if (!resolvedId && queryKey) {
    const payload = searchParams.get(queryKey);
    if (payload) {
      try {
        const parsed = JSON.parse(decodeURIComponent(payload));
        resolvedId =
          parsed.documentId || parsed.billId || parsed.actId || parsed.id;
        initialDocument = {
          ...parsed,
          id: String(resolvedId),
          documentId: String(resolvedId),
          documentType,
          pdfUrl: parsed.pdfUrl || parsed.pdf,
          sourceUrl: parsed.sourceUrl || parsed.link,
        };
      } catch {
        initialDocument = null;
      }
    }
  }
  if (!resolvedId) {
    return (
      <div className="grid h-screen place-items-center bg-[#e9e3da] text-center">
        <p className="font-serif text-2xl text-[#8f1d2c]">
          No document was selected.
        </p>
      </div>
    );
  }
  return (
    <DocumentChatLayout
      documentType={documentType}
      documentId={String(resolvedId)}
      initialDocument={initialDocument}
    />
  );
}
