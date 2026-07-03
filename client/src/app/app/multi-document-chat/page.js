"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
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
  return (
    <WorkspaceShell
      activeKey="documents"
      title="Cross-document Research"
    >
      <MultiDocumentChat
        documentIds={documentIds}
        comparisonId={comparisonId}
      />
    </WorkspaceShell>
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
