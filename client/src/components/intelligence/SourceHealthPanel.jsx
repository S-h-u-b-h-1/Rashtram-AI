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
    className: "bg-[#f5dfda] text-[#8d372b]",
  },
  Blocked: {
    icon: CircleAlert,
    className: "bg-[#f5dfda] text-[#8d372b]",
  },
  Degraded: {
    icon: CircleAlert,
    className: "bg-[#f6e7ce] text-[#815b25]",
  },
  "Not Run": {
    icon: CircleDashed,
    className: "bg-[#ece8e1] text-[#777066]",
  },
  Planned: {
    icon: CircleDashed,
    className: "bg-[#ece8e1] text-[#777066]",
  },
};

export function SourceHealthPanel({ sources }) {
  const publicSourceGroups = summarizePublicSources(sources);
  return (
    <section className="surface-card p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9e4937]">
          Provenance monitor
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#c30000]">
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
              className="rounded-2xl border border-[#c30000]/9 bg-[#fffdf8] p-4"
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
