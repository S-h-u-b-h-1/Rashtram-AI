"use client";

import EGazette from "@/components/EGazette";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default function EGazettePage() {
  return (
    <ProtectedRoute>
      <WorkspaceShell activeKey="egazette" title="eGazette Research">
        <EGazette />
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
