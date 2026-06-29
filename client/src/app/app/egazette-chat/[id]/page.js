"use client";

import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DocumentChatRoute } from "@/components/document-chat/DocumentChatRoute";

export default function EGazetteChatPage() {
  const params = useParams();
  return (
    <ProtectedRoute>
      <DocumentChatRoute
        documentType="gazette"
        documentId={String(params.id)}
      />
    </ProtectedRoute>
  );
}
