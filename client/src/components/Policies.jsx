"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DocumentExplorer } from "@/components/documents/DocumentExplorer";
import { cn } from "@/lib/utils";

const POLICY_VIEWS = [
  {
    key: "all",
    label: "All Reports",
    type: "policy",
    source: "policyedge",
    title: "PolicyEdge Policy Reports",
    description:
      "Latest policy reports and analyses from PolicyEdge — covering governance, finance, health, agriculture, infrastructure, and development.",
  },
  {
    key: "governance",
    label: "Governance",
    type: "policy",
    source: "policyedge",
    category: "Governance",
    title: "Governance Reports",
    description:
      "Policy reports on governance, public administration, and institutional reform.",
  },
  {
    key: "economy",
    label: "Economy & Finance",
    type: "policy",
    source: "policyedge",
    category: "Economy",
    title: "Economy & Finance Reports",
    description:
      "Analyses on fiscal policy, financial stability, capital markets, and economic development.",
  },
  {
    key: "health",
    label: "Health",
    type: "policy",
    source: "policyedge",
    category: "Health",
    title: "Health Policy Reports",
    description:
      "Policy research on public health, healthcare systems, and health financing.",
  },
  {
    key: "environment",
    label: "Environment & Climate",
    type: "policy",
    source: "policyedge",
    category: "Environment",
    title: "Environment & Climate Reports",
    description:
      "Reports on climate policy, sustainability, and environmental governance.",
  },
];

export default function Policies() {
  const searchParams = useSearchParams();
  const policyType = searchParams.get("policyType") || "all";
  const activeView =
    POLICY_VIEWS.find((v) => v.key === policyType) || POLICY_VIEWS[0];

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-2 px-1">
        {POLICY_VIEWS.map((view) => (
          <Link
            key={view.key}
            href={`/app?view=policies&policyType=${view.key}`}
            className={cn(
              "shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition",
              activeView.key === view.key
                ? "bg-[#8f1d2c] text-white"
                : "text-[#706a61] hover:bg-[#eee0dc] hover:text-[#8f1d2c]",
            )}
          >
            {view.label}
          </Link>
        ))}
      </nav>
      <DocumentExplorer
        key={activeView.key}
        type={activeView.type}
        source={activeView.source}
        title={activeView.title}
        description={activeView.description}
        eyebrow="PolicyEdge · Reports & Data Releases"
        filterKeys={[
          "year",
          "category",
          "jurisdiction",
        ]}
        filterLabels={{ jurisdiction: "Jurisdiction" }}
        dataNote="Reports sourced from PolicyEdge covering Indian and international policy research."
      />
    </div>
  );
}
