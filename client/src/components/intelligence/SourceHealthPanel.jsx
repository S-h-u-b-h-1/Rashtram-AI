import { CircleAlert, CircleCheck, CircleDashed, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/document-links";
import { summarizePublicSources } from "@/lib/source-branding";

const STATUS_STYLES = {
  Fresh: {
    icon: CircleCheck,
    className: "bg-[#e1eee4] text-[#28613c]",
  },
  Connected: {
    icon: CircleCheck,
    className: "bg-[#e8ece8] text-[#405248]",
  },
  Stale: {
    icon: Clock3,
    className: "bg-[#f6e7ce] text-[#815b25]",
  },
  Error: {
    icon: CircleAlert,
    className: "bg-[#e7d8d5] text-[#7f3038]",
  },
  Blocked: {
    icon: CircleAlert,
    className: "bg-[#e7d8d5] text-[#7f3038]",
  },
  Degraded: {
    icon: CircleAlert,
    className: "bg-[#f6e7ce] text-[#815b25]",
  },
  "Not Run": {
    icon: CircleDashed,
    className: "bg-[#ece8e1] text-[#777066]",
  },
};

export function SourceHealthPanel({ sources, compact = false }) {
  const publicSourceGroups = summarizePublicSources(sources);
  if (compact) {
    const connected = publicSourceGroups.filter((source) =>
      ["Fresh", "Connected", "Stale", "Degraded"].includes(source.status),
    ).length;
    const records = publicSourceGroups.reduce(
      (total, source) => total + Number(source.documentCount || 0),
      0,
    );
    return (
      <section className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-xs font-semibold text-[#29312d]">Official source health</p>
          <p className="mt-1 text-[11px] text-[#777066]">
            {connected} of {publicSourceGroups.length} source groups connected
          </p>
        </div>
        <p className="text-xs font-semibold text-[#8f1d2c]">
          {records.toLocaleString("en-IN")} source-backed records
        </p>
      </section>
    );
  }
  return (
    <section className="surface-card p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
          Provenance monitor
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
          Verified Public Legislative Sources
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#777066]">
          Continuously refreshed public legislative records with update
          timestamps and internal provenance controls.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {publicSourceGroups.map((source) => {
          const style =
            STATUS_STYLES[source.status] || STATUS_STYLES["Not Run"];
          const StatusIcon = style.icon;
          return (
            <article
              key={source.key}
              className="rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#29312d]">
                    {source.label}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#81796e]">
                    {source.purpose}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
                    style.className,
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {source.status}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.08em] text-[#928a7f]">
                <span>{source.documentCount.toLocaleString()} records</span>
                <span>{formatRelativeTime(source.lastRefresh)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
