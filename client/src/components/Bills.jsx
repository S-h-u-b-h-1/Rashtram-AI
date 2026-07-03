"use client";

import { DocumentExplorer } from "@/components/documents/DocumentExplorer";

export default function Bills() {
  return (
    <DocumentExplorer
      type="bill"
      jurisdictionLevel="parliament"
      title="Parliament Bills"
      description="Search verified Bills by title, number, status, ministry, authority, jurisdiction, metadata, or indexed PDF text."
    />
  );
}
