import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { formatDate } from "@/lib/document-links";

export function GazetteResearch({ chats = [], categories = [] }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
            Gazette research
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
            Your Gazette workspace
          </h2>
          <p className="mt-2 text-sm text-[#777066]">
            Recent Gazette conversations and categories you return to.
          </p>
        </div>
        <Newspaper className="h-5 w-5 text-[#874047]" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8277]">
            Recent Gazette research
          </p>
          {chats.length ? (
            <div className="mt-3 space-y-2">
              {chats.slice(0, 4).map((chat) => (
                <Link
                  key={chat.id}
                  href={`/app/egazette-chat/${chat.documentId}`}
                  className="group flex items-center gap-3 rounded-xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-3"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eee0dc] text-[#874047]">
                    <Newspaper className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-semibold text-[#29312d]">
                      {chat.title}
                    </p>
                    <p className="mt-1 text-[10px] text-[#8a8277]">
                      {chat.messageCount} messages · {formatDate(chat.updatedAt)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#aaa195] transition group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-[#8f1d2c]/10 p-5 text-center text-xs text-[#81796e]">
              No Gazette conversations yet.
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8277]">
            Favourite Gazette categories
          </p>
          {categories.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={category.label}
                  className="rounded-full bg-[#eee0dc] px-3 py-2 text-[11px] font-medium text-[#874047]"
                >
                  {category.label}
                  <strong className="ml-1.5">{category.interactions}</strong>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-[#81796e]">
              Categories appear after activity history is enabled and Gazette
              records are opened.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
