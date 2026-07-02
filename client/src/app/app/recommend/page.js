"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { BusinessProblemRecommender } from "@/components/recommendations/BusinessProblemRecommender";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default function RecommendPage() {
  return (
    <ProtectedRoute>
      <WorkspaceShell activeKey="recommend" title="Policy Recommendation">
        <BusinessProblemRecommender />
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
