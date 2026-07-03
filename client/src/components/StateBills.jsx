"use client";

import { DocumentExplorer } from "@/components/documents/DocumentExplorer";

export default function StateBills() {
  return (
    <DocumentExplorer
      type="state-bill"
      title="State Bills"
      description="Search and research Bills introduced across Indian state legislatures using verified source records and one consistent document workspace."
      eyebrow="State legislative catalogue"
      filterKeys={[
        "status",
        "year",
        "ministry",
        "authority",
        "category",
        "jurisdiction",
        "source",
      ]}
      filterLabels={{
        jurisdiction: "State",
        authority: "Legislature / authority",
      }}
      dataNote="Status is shown only when the official source reports it. Many historical state Bill records do not include a standardized status."
    />
  );
}
