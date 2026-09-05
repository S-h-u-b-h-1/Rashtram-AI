"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceUtilities } from "@/components/workspace/WorkspaceUtilities";
export default function HelpPage() { return <ProtectedRoute><WorkspaceShell title="Help"><WorkspaceUtilities mode="help" /></WorkspaceShell></ProtectedRoute>; }
