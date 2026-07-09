"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDocument } from "@/lib/api";
import { DocumentChatLayout } from "@/components/document-chat/DocumentChatLayout";

export function UniversalDocumentRoute({ documentId }) {
  const [document, setDocument] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchDocument(documentId)
      .then((response) => {
        if (active) setDocument(response.document);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [documentId]);

  if (error) {
    return (
      <div className="grid h-dvh place-items-center bg-[#e9e3da] p-6 text-center text-sm text-[#85434a]">
        {error}
      </div>
    );
  }
  if (!document) {
    return (
      <div className="grid h-dvh place-items-center bg-[#e9e3da]">
        <Loader2 className="h-8 w-8 animate-spin text-[#8f1d2c]" />
      </div>
    );
  }
  return (
    <DocumentChatLayout
      documentType={document.type}
      documentId={document.id}
      initialDocument={document}
    />
  );
}
