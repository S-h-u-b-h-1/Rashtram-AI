import { Building2 } from "lucide-react";
import { formatDate } from "@/lib/document-links";

export function MinistryActivity({ ministries = [] }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-[#874047]" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
          Ministry activity
        </p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {ministries.slice(0, 8).map((ministry) => (
          <article
            key={ministry.ministry}
            className="rounded-xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-3"
          >
            <p className="line-clamp-2 text-xs font-semibold leading-5 text-[#29312d]">
              {ministry.ministry}
            </p>
            <p className="mt-2 text-[10px] text-[#81796e]">
              {ministry.documentCount} records · latest{" "}
              {formatDate(ministry.latestActivity)}
            </p>
          </article>
        ))}
        {!ministries.length && (
          <p className="text-xs text-[#81796e]">
            Ministry activity will appear when verified metadata is available.
          </p>
        )}
      </div>
    </section>
  );
}
