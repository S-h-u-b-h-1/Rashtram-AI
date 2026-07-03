"use client";

import { DocumentExplorer } from "@/components/documents/DocumentExplorer";

export default function StateActs() {
  return (
    <DocumentExplorer
      type="state-act"
      title="State Acts"
      description="Search enacted state law through verified source records, shared filters, AI summaries, relationships, and the universal research workspace."
      eyebrow="State legislative catalogue"
      filterKeys={[
        "year",
        "authority",
        "category",
        "jurisdiction",
        "source",
      ]}
      filterLabels={{
        jurisdiction: "State",
        authority: "Legislature / authority",
      }}
      dataNote="Only source-backed state Acts are shown. Publication and commencement dates appear when supplied by the official record."
    />
  );
}
