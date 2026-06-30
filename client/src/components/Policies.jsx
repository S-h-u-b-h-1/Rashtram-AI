"use client";

import { DocumentExplorer } from "@/components/documents/DocumentExplorer";

export default function Policies() {
  return (
    <DocumentExplorer
      type="policy,scheme,guideline,consultation-paper,strategy-paper,white-paper,discussion-paper,recommendation,report,government-resolution,cabinet-decision"
      title="Policies, consultations and strategy"
      description="Research national and state policies, schemes, guidelines, consultations, strategy papers, government reports, resolutions, and Cabinet decisions through one catalogue."
      eyebrow="National public policy catalogue"
    />
  );
}
