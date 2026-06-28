import { Database, FileText, Globe2, Link2 } from "lucide-react";
import { formatDate, humanize } from "@/lib/document-links";
import { getPublicSourceLabel } from "@/lib/source-branding";

export function PlatformCoverage({ coverage }) {
  const headlineStats = [
    {
      label: "Total documents",
      value: coverage.totalDocuments,
      icon: Database,
    },
    {
      label: "Documents with PDFs",
      value: coverage.documentsWithPdf,
      icon: FileText,
    },
    {
      label: "Source resources",
      value: coverage.sourceResources,
      icon: Link2,
    },
    {
      label: "Jurisdictions",
      value: coverage.jurisdictions,
      icon: Globe2,
    },
  ];
  const coreCoverage = [
    ["Parliament Bills", coverage.parliamentBills],
    ["Parliament Acts", coverage.parliamentActs],
    ["State Bills", coverage.stateBills],
    ["State Acts", coverage.stateActs],
  ];

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9e4937]">
            Platform-wide data
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#c30000]">
            Rashtram AI coverage
          </h2>
          <p className="mt-2 text-sm text-[#777066]">
            Catalogue coverage is shared platform infrastructure, not personal
            research activity.
          </p>
        </div>
        {coverage.lastCollection && (
          <div className="rounded-xl bg-[#f2ece1] px-4 py-3 text-xs text-[#6f685f]">
            <span className="font-semibold text-[#29312d]">
              Latest catalogue refresh:
            </span>{" "}
            {getPublicSourceLabel(coverage.lastCollection.sourceName)} ·{" "}
            {formatDate(coverage.lastCollection.completedAt)} ·{" "}
            {humanize(coverage.lastCollection.status)}
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {headlineStats.map((item) => {
          const CoverageIcon = item.icon;
          return (
            <article
              key={item.label}
              className="rounded-2xl border border-[#c30000]/9 bg-[#fffdf8] p-4"
            >
              <CoverageIcon className="h-4 w-4 text-[#9f4937]" />
              <p className="mt-4 font-serif text-3xl text-[#c30000]">
                {item.value.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[#81796e]">
                {item.label}
              </p>
            </article>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl bg-[#c30000] p-5 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#efb36f]">
            Core catalogue
          </p>
          <div className="mt-4 space-y-3">
            {coreCoverage.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-white/8 pb-3 text-sm last:border-0 last:pb-0"
              >
                <span className="text-white/55">{label}</span>
                <span className="font-semibold">
                  {value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#c30000]/9 bg-[#fffdf8] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9f4937]">
            Document types present
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {coverage.byDocumentType.map((item) => (
              <span
                key={item.documentType}
                className="rounded-full border border-[#c30000]/10 bg-[#f4eee4] px-3 py-2 text-xs text-[#514d46]"
              >
                {humanize(item.documentType)}{" "}
                <strong className="ml-1 text-[#9f4937]">
                  {item.documents.toLocaleString()}
                </strong>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
