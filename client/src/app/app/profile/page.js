"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { ProfileView } from "@/components/profile/ProfileView";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <WorkspaceShell activeKey="profile" title="Research Profile">
        <ProfileView />
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
