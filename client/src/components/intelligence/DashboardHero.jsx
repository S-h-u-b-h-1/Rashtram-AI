import { ArrowRight, Clock3, Search } from "lucide-react";
import { useState } from "react";
import { formatDate, formatRelativeTime } from "@/lib/document-links";

export function DashboardHero({ data, onSearch }) {
  const [query, setQuery] = useState("");

  return (
    <section className="relative overflow-hidden rounded-[1.8rem] bg-[#8f1d2c] p-6 text-white sm:p-8 lg:p-9">
      <div className="policy-grid absolute inset-0 opacity-20" />
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#a85a52]/18 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
              <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 font-semibold uppercase tracking-[0.14em] text-[#c1a06f]">
                Today&apos;s Legislative Brief
              </span>
              <span>{formatDate(data.currentDate)}</span>
            </div>
            <h2 className="mt-5 font-serif text-3xl leading-tight tracking-[-0.035em] sm:text-5xl">
              {data.userGreeting}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">
              {data.briefSummary}
            </p>
            <form
              className="mt-6 flex max-w-2xl gap-2 rounded-2xl border border-white/12 bg-white/[0.07] p-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (query.trim()) onSearch(query.trim());
              }}
            >
              <Search className="ml-2 mt-3 h-4 w-4 shrink-0 text-white/55" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Bills, Acts, policies, Gazette and PDF text"
                className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/40"
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#fffaf0] px-4 text-xs font-semibold text-[#8f1d2c]"
              >
                Search
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          <div className="min-w-[230px] rounded-2xl border border-white/10 bg-white/[0.055] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/82">
              <Clock3 className="h-4 w-4 text-[#c1a06f]" />
              Source status
            </div>
            <p className="mt-3 font-serif text-2xl">
              {data.freshnessStatus.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/42">
              Last refresh {formatRelativeTime(data.lastRefresh)}
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
