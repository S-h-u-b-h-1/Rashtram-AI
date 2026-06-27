import Link from "next/link";
import { ArrowRight, ExternalLink, FileText } from "lucide-react";
import {
  buildResearchHref,
  formatDate,
  humanize,
} from "@/lib/document-links";

export function DocumentListSection({
  eyebrow,
  title,
  documents,
  emptyMessage,
  onViewAll,
}) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9e4937]">
            {eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#19231f]">{title}</h2>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 rounded-full border border-[#19231f]/10 px-3 py-2 text-xs font-semibold text-[#5f5a52] transition hover:bg-[#19231f] hover:text-white"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-5 space-y-2">
        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#19231f]/12 bg-[#f7f2e8]/65 p-7 text-center">
            <FileText className="mx-auto h-6 w-6 text-[#9b9387]" />
            <p className="mt-3 text-sm text-[#706a61]">{emptyMessage}</p>
          </div>
        ) : (
          documents.slice(0, 6).map((document) => {
            const researchHref = buildResearchHref(document);
            const row = (
              <div className="group flex items-start gap-3 rounded-xl border border-transparent p-3 transition hover:border-[#19231f]/8 hover:bg-[#f5efe5]">
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ebe3d6] text-[#9f4937]">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#29312d]">
                    {document.title}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.08em] text-[#8a8277]">
                    <span>{humanize(document.documentType)}</span>
                    <span>{document.sourceName}</span>
                    <span>{formatDate(document.eventDate)}</span>
                  </div>
                </div>
                {researchHref ? (
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-[#aaa195] transition group-hover:translate-x-0.5 group-hover:text-[#9f4937]" />
                ) : (
                  <ExternalLink className="mt-2 h-4 w-4 shrink-0 text-[#aaa195]" />
                )}
              </div>
            );

            return researchHref ? (
              <Link key={document.id} href={researchHref}>
                {row}
              </Link>
            ) : document.sourceUrl ? (
              <a
                key={document.id}
                href={document.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {row}
              </a>
            ) : (
              <div key={document.id}>{row}</div>
            );
          })
        )}
      </div>
    </section>
  );
}
