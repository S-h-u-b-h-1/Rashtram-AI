import {
  BookOpenText,
  Database,
  FileCheck2,
  FileText,
  Globe2,
  Landmark,
  Scale,
  ScrollText,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/document-links";

export function PlatformCoverageOverview({ coverage }) {
  const stats = [
    ["Total documents", coverage.totalDocuments, Database],
    ["Parliament Bills", coverage.parliamentBills, Landmark],
    ["State Bills", coverage.stateBills, FileText],
    ["Acts", coverage.acts, Scale],
    ["Gazette records", coverage.gazetteDocuments, ScrollText],
    ["Policies", coverage.policyDocuments, BookOpenText],
    ["Documents with PDFs", coverage.documentsWithPdf, FileCheck2],
    ["Jurisdictions", coverage.jurisdictions, Globe2],
  ];

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
            Data collection and platform coverage
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
            Verified catalogue coverage
          </h2>
          <p className="mt-2 text-sm text-[#777066]">
            Live counts from PostgreSQL. No estimates or projected records.
          </p>
        </div>
        <p className="text-[10px] text-[#81796e]">
          Latest ingestion {formatRelativeTime(coverage.lastRefresh)}
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <article
            key={label}
            className="rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4"
          >
            <Icon className="h-4 w-4 text-[#874047]" />
            <p className="mt-3 font-serif text-2xl text-[#8f1d2c]">
              {Number(value || 0).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[10px] text-[#81796e]">{label}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
