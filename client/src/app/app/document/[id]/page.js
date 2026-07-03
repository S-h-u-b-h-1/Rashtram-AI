"use client";

import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { UniversalDocumentRoute } from "@/components/documents/UniversalDocumentRoute";

export default function UniversalDocumentPage() {
  const params = useParams();
  return (
    <ProtectedRoute>
      <UniversalDocumentRoute documentId={String(params.id)} />
    </ProtectedRoute>
  );
}
