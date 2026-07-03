import { Building2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/document-links";

export function TrendingMinistries({ ministries = [] }) {
  if (!ministries.length) return null;

  return (
    <section className="surface-card p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
        Real catalogue metadata
      </p>
      <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
        Trending ministries
      </h2>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {ministries.slice(0, 6).map((ministry) => (
          <article
            key={ministry.ministry}
            className="flex items-center gap-3 rounded-xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-3"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eee0dc] text-[#8f1d2c]">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#29312d]">
                {ministry.ministry}
              </p>
              <p className="mt-1 text-[10px] text-[#81796e]">
                {Number(ministry.documentCount || 0).toLocaleString("en-IN")}{" "}
                records · latest {formatRelativeTime(ministry.latestActivity)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
