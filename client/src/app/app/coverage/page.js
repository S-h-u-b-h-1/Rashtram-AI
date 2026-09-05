"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceUtilities } from "@/components/workspace/WorkspaceUtilities";
export default function CoveragePage() { return <ProtectedRoute><WorkspaceShell title="Coverage & Sources"><WorkspaceUtilities mode="coverage" /></WorkspaceShell></ProtectedRoute>; }
