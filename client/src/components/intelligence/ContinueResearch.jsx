"use client";

import Link from "next/link";
import { ArrowRight, BookOpenText } from "lucide-react";
import { buildResearchHref, formatDate } from "@/lib/document-links";
import { trackActivity } from "@/lib/api";

export function ContinueResearch({ chats }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
          Your workspace
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
          Continue research
        </h2>
      </div>

      {chats.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#8f1d2c]/12 bg-[#f1ece3]/65 p-7 text-center">
          <BookOpenText className="mx-auto h-6 w-6 text-[#9b9387]" />
          <p className="mt-3 text-sm font-medium text-[#514d46]">
            No research conversations yet
          </p>
          <p className="mt-1 text-xs text-[#8a8277]">
            Open a Bill, Act, or Gazette document to begin a grounded research
            thread.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {chats.slice(0, 6).map((chat) => {
            const href = buildResearchHref(chat);
            return (
              <Link
                key={`${chat.documentType}-${chat.id}`}
                href={href || "/app"}
                onClick={() =>
                  trackActivity({
                    event_type: "research_continued",
                    entity_type: chat.documentType,
                    entity_id: chat.documentId,
                    document_id: chat.documentId,
                    page_path: window.location.pathname,
                    metadata_json: {
                      documentType: chat.documentType,
                    },
                  })
                }
                className="group rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4 transition hover:-translate-y-0.5 hover:border-[#8c4548]/25 hover:shadow-[0_12px_30px_rgba(143, 29, 44,0.06)]"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ebe3d6] text-[#874047]">
                    <BookOpenText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#29312d]">
                      {chat.title}
                    </p>
                    <p className="mt-2 text-[11px] text-[#857e73]">
                      {chat.messageCount} messages ·{" "}
                      {formatDate(chat.updatedAt)}
                    </p>
                  </div>
                  <ArrowRight className="mt-2 h-4 w-4 text-[#aaa195] transition group-hover:translate-x-0.5 group-hover:text-[#874047]" />
                </div>
                {chat.summary && (
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#777066]">
                    {chat.summary}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
