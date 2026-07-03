"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { formatDate, humanize } from "@/lib/document-links";

export function LegislativeUpdateGrid({ groups = [] }) {
  const visibleGroups = groups.filter((group) => group.documents?.length);

  return (
    <section className="surface-card p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
          Verified official records
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
          Recent legislative updates
        </h2>
        <p className="mt-2 text-sm text-[#777066]">
          Recently published records, grouped by research library.
        </p>
      </div>

      {visibleGroups.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleGroups.map((group) => (
            <article
              key={group.label}
              className="rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[#874047]">
                  {group.label}
                </h3>
                {group.href && (
                  <Link
                    href={group.href}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8f1d2c]"
                  >
                    View all
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <div className="mt-3 divide-y divide-[#8f1d2c]/8">
                {group.documents.slice(0, 3).map((document) => (
                  <Link
                    key={document.id}
                    href={`/app/document/${document.id}`}
                    className="group flex gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eee0dc] text-[#8f1d2c]">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-xs font-semibold leading-5 text-[#29312d] group-hover:text-[#8f1d2c]">
                        {document.title}
                      </span>
                      <span className="mt-1 block text-[10px] text-[#81796e]">
                        {humanize(document.documentType || document.type)} ·{" "}
                        {formatDate(
                          document.publicationDate ||
                            document.introducedDate ||
                            document.enactedDate,
                          document.year || "Date unavailable",
                        )}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[#8f1d2c]/12 bg-[#f1ece3]/65 p-7 text-center">
          <p className="text-sm text-[#706a61]">
            No recent documents are available from connected sources.
          </p>
        </div>
      )}
    </section>
  );
}
