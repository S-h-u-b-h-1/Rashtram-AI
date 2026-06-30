"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import StateBills from "@/components/StateBills";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default function StateBillsPage() {
  return (
    <ProtectedRoute>
      <WorkspaceShell activeKey="state-bills" title="State Bills">
        <StateBills />
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
