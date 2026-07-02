"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DocumentExplorer } from "@/components/documents/DocumentExplorer";
import { cn } from "@/lib/utils";

const POLICY_VIEWS = [
  {
    key: "all",
    label: "All policy records",
    type: "policy,scheme,guideline,office-memorandum,circular,consultation-paper,strategy-paper,white-paper,discussion-paper,recommendation,report,government-resolution,cabinet-decision",
    title: "Policies and public programmes",
    description:
      "Research official policies, schemes, guidelines, consultations, reports, memoranda, circulars, and frameworks through one source-aware catalogue.",
  },
  {
    key: "national",
    label: "National Policies",
    type: "policy",
    scope: "policy-national",
    title: "National Policies",
  },
  {
    key: "state",
    label: "State Policies",
    type: "policy",
    scope: "policy-state",
    title: "State Policies",
  },
  { key: "schemes", label: "Schemes", type: "scheme", title: "Schemes" },
  {
    key: "guidelines",
    label: "Guidelines",
    type: "guideline",
    title: "Guidelines",
  },
  {
    key: "memoranda",
    label: "Office Memoranda",
    type: "office-memorandum",
    title: "Office Memoranda",
  },
  {
    key: "consultations",
    label: "Consultation Papers",
    type: "consultation-paper",
    title: "Consultation Papers",
  },
  {
    key: "circulars",
    label: "Circulars",
    type: "circular",
    title: "Circulars",
  },
  {
    key: "frameworks",
    label: "Framework Documents",
    type: "strategy-paper,discussion-paper,recommendation,government-resolution,cabinet-decision",
    title: "Framework Documents",
  },
  {
    key: "reports",
    label: "Reports & White Papers",
    type: "report,white-paper",
    title: "Reports and White Papers",
  },
];

export default function Policies() {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("policyType") || "all";
  const activeView =
    POLICY_VIEWS.find((view) => view.key === requestedView) || POLICY_VIEWS[0];

  return (
    <div className="space-y-4">
      <nav
        aria-label="Policy document categories"
        className="flex gap-2 overflow-x-auto rounded-2xl border border-[#8f1d2c]/9 bg-[#f7f2eb] p-2"
      >
        {POLICY_VIEWS.map((view) => (
          <Link
            key={view.key}
            href={
              view.key === "all"
                ? "/app?view=policies"
                : `/app?view=policies&policyType=${view.key}`
            }
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
        scope={activeView.scope}
        title={activeView.title}
        description={
          activeView.description ||
          `Search and research source-backed ${activeView.label.toLowerCase()} with AI summaries, chat, related records, and original PDFs.`
        }
        eyebrow="Public policy library"
        filterKeys={[
          "year",
          "ministry",
          "authority",
          "category",
          "jurisdiction",
          "source",
          "sourceType",
          "state",
          "language",
        ]}
        filterLabels={{ jurisdiction: "State / jurisdiction" }}
        dataNote="Only official public records available through connected sources are shown. Missing coverage is never estimated."
      />
    </div>
  );
}
