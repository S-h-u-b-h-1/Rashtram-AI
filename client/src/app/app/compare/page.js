"use client";

import { Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { DocumentComparison } from "@/components/documents/DocumentComparison";

export default function ComparePage() {
  return (
    <ProtectedRoute>
      <WorkspaceShell activeKey="compare" title="Document Comparison">
        <Suspense fallback={null}>
          <DocumentComparison />
        </Suspense>
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
