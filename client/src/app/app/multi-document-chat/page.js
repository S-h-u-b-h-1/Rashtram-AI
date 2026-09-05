"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { uniqueIds } from "@/lib/research-workspace.mjs";
import { MultiDocumentChat } from "@/components/documents/MultiDocumentChat";

function MultiDocumentChatPageContent() {
  const searchParams = useSearchParams();
  const documentIds = useMemo(
    () =>
      [
        ...new Set(
          String(searchParams.get("ids") || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ].slice(0, 5),
    [searchParams],
  );
  const comparisonId = searchParams.get("comparison");
  const sourceIds = useMemo(() => uniqueIds(searchParams.get("sources")), [searchParams]);
  return (
      <MultiDocumentChat
        key={`${documentIds.join(',')}|${sourceIds.join(',')}`}
        documentIds={documentIds}
        comparisonId={comparisonId}
        initialSourceIds={sourceIds}
        draftQuestion={{ text: searchParams.get("q") || "" }}
      />
  );
}

export default function MultiDocumentChatPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <MultiDocumentChatPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
