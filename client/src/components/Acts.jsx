"use client";

import { DocumentExplorer } from "@/components/documents/DocumentExplorer";

export default function Acts() {
  return (
    <DocumentExplorer
      type="act"
      jurisdictionLevel="parliament"
      title="Parliament Acts"
      description="Search enacted law through the same document repository, filters, relationships, summaries, and research workspace used across the platform."
    />
  );
}
