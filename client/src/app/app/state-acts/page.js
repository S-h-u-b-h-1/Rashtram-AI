"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import StateActs from "@/components/StateActs";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default function StateActsPage() {
  return (
    <ProtectedRoute>
      <WorkspaceShell activeKey="state-acts" title="State Acts">
        <StateActs />
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
