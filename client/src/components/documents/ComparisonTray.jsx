"use client";

import Link from "next/link";
import { GitCompareArrows, Trash2, X } from "lucide-react";
import { useComparison } from "@/context/ComparisonContext";

export function ComparisonTray() {
  const { documents, removeDocument, clear } = useComparison();
  if (!documents.length) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/15 bg-[#671723]/95 p-3 text-white shadow-2xl backdrop-blur-xl md:left-[300px] md:right-6"
      aria-label="Documents selected for comparison"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
            Compare selection · {documents.length}/5
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {documents.map((document) => (
              <span
                key={document.id}
                className="inline-flex max-w-[290px] shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[11px]"
              >
                <span className="min-w-0">
                  <span className="block truncate">{document.title}</span>
                  <span className="mt-0.5 block truncate text-[9px] text-white/45">
                    {[
                      document.type,
                      document.ministry ||
                        document.state ||
                        document.jurisdiction,
                      document.year,
                      document.researchReady ? "Research ready" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeDocument(document.id)}
                  aria-label={`Remove ${document.title} from comparison`}
                  className="text-white/60 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
          <Link
            href={`/app/compare?ids=${documents
              .map((document) => document.id)
              .join(",")}`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#fffaf0] px-4 py-2.5 text-xs font-semibold text-[#8f1d2c]"
          >
            <GitCompareArrows className="h-4 w-4" />
            {documents.length >= 2 ? "Compare selected" : "Find matches"}
          </Link>
        </div>
      </div>
    </aside>
  );
}
