"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { MyResearch } from "@/components/workspace/MyResearch";
export default function MyResearchPage() { return <ProtectedRoute><WorkspaceShell activeKey="research" title="My Research"><MyResearch /></WorkspaceShell></ProtectedRoute>; }
