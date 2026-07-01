"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenText,
  ExternalLink,
  Radio,
} from "lucide-react";
import {
  buildResearchHref,
  formatDate,
  humanize,
} from "@/lib/document-links";
import { getPublicSourceLabel } from "@/lib/source-branding";
import { trackActivity } from "@/lib/api";

export function IntelligenceFeed({
  events,
  isFallback,
  eyebrow = "Verified official records",
  title = "What happened recently",
}) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
            {eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
            {title}
          </h2>
        </div>
        <Radio className="h-5 w-5 text-[#8c4548]" />
      </div>

      {isFallback && (
        <div className="mt-5 rounded-xl border border-[#98705d]/25 bg-[#f8ead7] px-4 py-3 text-xs leading-5 text-[#754b2e]">
          No current event record is available. The list below contains recent
          catalogue additions from verified sources.
        </div>
      )}

      {events.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#8f1d2c]/12 bg-[#f1ece3]/65 p-8 text-center">
          <p className="text-sm font-medium text-[#514d46]">
            No legislative events or catalogue documents are available yet.
          </p>
          <p className="mt-2 text-xs text-[#8a8277]">
            The feed will populate after a verified public record feed
            completes its first refresh.
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-[#8f1d2c]/8">
          {events.slice(0, 10).map((event) => {
            const researchHref = buildResearchHref(event);
            return (
              <article
                key={`${event.id}-${event.eventType}`}
                className="py-5 first:pt-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#8f1d2c] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                    {humanize(event.eventType)}
                  </span>
                  <span className="rounded-full bg-[#eee6d9] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6f4335]">
                    {humanize(event.documentType)}
                  </span>
                  <span className="text-[11px] text-[#8a8277]">
                    {formatDate(event.eventDate || event.createdAt)}
                  </span>
                </div>

                <h3 className="mt-3 text-base font-semibold leading-6 text-[#25302b]">
                  {event.title}
                </h3>
                {event.summary && (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6f685f]">
                    {event.summary}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#857d72]">
                  <span className="font-semibold text-[#874047]">
                    {getPublicSourceLabel(event.sourceName)}
                  </span>
                  <span>{event.jurisdiction || "India"}</span>
                  {event.ministry && <span>{event.ministry}</span>}
                  {event.status && <span>{event.status}</span>}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {event.pdfUrl && (
                    <a
                      href={event.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        trackActivity({
                          event_type:
                            event.documentType === "bill"
                              ? "bill_opened"
                              : event.documentType === "act"
                                ? "act_opened"
                                : "document_opened",
                          entity_type: event.documentType,
                          entity_id: event.documentId || event.id,
                          document_id: event.documentId,
                          page_path: "/app",
                          metadata_json: {
                            documentType: event.documentType,
                            jurisdiction: event.jurisdiction,
                            category: event.category,
                            ministry: event.ministry,
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#8f1d2c]/12 px-3 py-2 text-xs font-semibold text-[#514d46] transition hover:bg-[#f2ece1]"
                    >
                      View PDF
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {researchHref && (
                    <Link
                      href={researchHref}
                      onClick={() =>
                        trackActivity({
                          event_type: "research_continued",
                          entity_type: event.documentType,
                          entity_id: event.documentId || event.id,
                          document_id: event.documentId,
                          page_path: "/app",
                          metadata_json: {
                            documentType: event.documentType,
                            jurisdiction: event.jurisdiction,
                            category: event.category,
                            ministry: event.ministry,
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#8f1d2c] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2d3a34]"
                    >
                      <BookOpenText className="h-3.5 w-3.5" />
                      Research
                    </Link>
                  )}
                  {event.sourceUrl && (
                    <a
                      href={event.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        trackActivity({
                          event_type: "source_opened",
                          entity_type: event.documentType,
                          entity_id: event.documentId || event.id,
                          document_id: event.documentId,
                          page_path: "/app",
                          metadata_json: {
                            documentType: event.documentType,
                            jurisdiction: event.jurisdiction,
                            publicSourceType: getPublicSourceLabel(
                              event.sourceName,
                            ),
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#8f1d2c]/12 px-3 py-2 text-xs font-semibold text-[#514d46] transition hover:bg-[#f2ece1]"
                    >
                      View source
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
