"use client";

import Link from "next/link";
import { ArrowRight, BookOpenText, FileText } from "lucide-react";
import { formatDate } from "@/lib/document-links";

export function LegislativeUpdateGrid({ groups = [] }) {
  const visibleGroups = groups.filter((group) => group.documents?.length);

  return (
    <section className="surface-card p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
          Choose a library
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
          Start from the document type you need
        </h2>
        <p className="mt-2 text-sm text-[#777066]">
          Researchers usually need one source set first. Open a library, then
          search or filter inside it.
        </p>
      </div>

      {visibleGroups.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.map((group) => (
            <Link
              key={group.label}
              href={group.href || "/app?view=documents"}
              className="group rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4 transition hover:-translate-y-0.5 hover:border-[#8f1d2c]/20 hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eee0dc] text-[#8f1d2c]">
                  <BookOpenText className="h-4 w-4" />
                </span>
                <ArrowRight className="h-4 w-4 text-[#aaa195] transition group-hover:translate-x-0.5 group-hover:text-[#8f1d2c]" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-[#29312d]">
                {group.label}
              </h3>
              <p className="mt-1 text-xs text-[#81796e]">
                {group.documents.length.toLocaleString("en-IN")} recent records
              </p>
              <div className="mt-4 rounded-xl bg-[#fffaf0] p-3">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8f1d2c]" />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-xs font-medium leading-5 text-[#514d46]">
                      {group.documents[0]?.title || "Open library"}
                    </p>
                    <p className="mt-1 text-[10px] text-[#8a8277]">
                      Latest{" "}
                      {formatDate(
                        group.documents[0]?.publicationDate ||
                          group.documents[0]?.introducedDate ||
                          group.documents[0]?.enactedDate,
                        group.documents[0]?.year || "date unavailable",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
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
