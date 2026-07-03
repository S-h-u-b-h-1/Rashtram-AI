"use client";

import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { GraphExplorer } from "@/components/graph/GraphExplorer";

export default function KnowledgeGraphPage() {
  const params = useParams();
  return (
    <ProtectedRoute>
      <GraphExplorer documentId={String(params.id)} />
    </ProtectedRoute>
  );
}
