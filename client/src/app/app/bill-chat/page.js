"use client";

import { Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DocumentChatRoute } from "@/components/document-chat/DocumentChatRoute";

export default function BillChatPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <DocumentChatRoute documentType="bill" queryKey="bill" />
      </Suspense>
    </ProtectedRoute>
  );
}
