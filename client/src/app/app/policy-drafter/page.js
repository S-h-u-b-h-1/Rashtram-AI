"use client";

import { PolicyDraftWorkspace } from "@/components/policy/PolicyDraftWorkspace";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default function PolicyDrafterPage() {
  return (
    <ProtectedRoute>
      <WorkspaceShell activeKey="policy-drafter" title="Policy Drafter">
        <PolicyDraftWorkspace />
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
