"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceUtilities } from "@/components/workspace/WorkspaceUtilities";
export default function SettingsPage() { return <ProtectedRoute><WorkspaceShell title="Settings"><WorkspaceUtilities mode="settings" /></WorkspaceShell></ProtectedRoute>; }
