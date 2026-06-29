"use client";

import { Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DocumentChatRoute } from "@/components/document-chat/DocumentChatRoute";

export default function ActChatPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <DocumentChatRoute documentType="act" queryKey="act" />
      </Suspense>
    </ProtectedRoute>
  );
}
