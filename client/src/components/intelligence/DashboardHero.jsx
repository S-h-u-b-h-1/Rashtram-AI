import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Clock3,
  FileSearch,
  Search,
  GitCompareArrows,
} from "lucide-react";
import { useState } from "react";
import { formatDate, formatRelativeTime } from "@/lib/document-links";

export function DashboardHero({ data, onSearch }) {
  const [query, setQuery] = useState("");

  return (
    <section className="relative overflow-hidden rounded-[1.8rem] bg-[#8f1d2c] p-5 text-white sm:p-7 lg:p-8">
      <div className="policy-grid absolute inset-0 opacity-20" />
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#a85a52]/18 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
              <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 font-semibold uppercase tracking-[0.14em] text-[#c1a06f]">
                Research Desk
              </span>
              <span>{formatDate(data.currentDate)}</span>
            </div>
            <h2 className="mt-5 font-serif text-3xl leading-tight tracking-[-0.035em] sm:text-5xl">
              What do you want to understand today?
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/64 sm:text-base">
              Search official Bills, Acts, Gazette records and policy documents.
              Open one record to ask cited questions, or select documents to
              compare.
            </p>
            {data.personalization?.enabled ? (
              <p className="mt-3 max-w-2xl text-xs leading-5 text-white/50">
                Personalized for {data.personalization.role?.replaceAll("_", " ") || "your role"}
                {data.personalization.topics?.length
                  ? ` · ${data.personalization.topics.slice(0, 3).join(", ")}`
                  : ""}
              </p>
            ) : (
              <Link
                href="/app/onboarding"
                className="mt-3 inline-flex rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/72 transition hover:bg-white/12 hover:text-white"
              >
                Personalize this dashboard
              </Link>
            )}
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
                placeholder="Search a topic, ministry, Act, Bill, Gazette or policy"
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
            <div className="mt-4 grid max-w-3xl gap-2 sm:grid-cols-3">
              {[
                {
                  label: "Search all documents",
                  hint: "Find the right record first",
                  href: "/app?view=documents",
                  icon: FileSearch,
                },
                {
                  label: "Continue reading",
                  hint: "Pick up recent work",
                  href: "#continue-research",
                  icon: BookOpenText,
                },
                {
                  label: "Compare documents",
                  hint: "Compare two to five records",
                  href: "/app/compare",
                  icon: GitCompareArrows,
                },
              ].map(({ label, hint, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-2xl border border-white/12 bg-white/[0.06] p-3 text-left transition hover:bg-white/12 hover:text-white"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-white/82">
                    <Icon className="h-3.5 w-3.5 text-[#c1a06f]" />
                    {label}
                  </span>
                  <span className="mt-1 block text-[11px] text-white/45">
                    {hint}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="min-w-[230px] rounded-2xl border border-white/10 bg-white/[0.055] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/82">
              <Clock3 className="h-4 w-4 text-[#c1a06f]" />
              Source freshness
            </div>
            <p className="mt-3 font-serif text-2xl">
              {data.freshnessStatus.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/42">
              Last refresh {formatRelativeTime(data.lastRefresh)}
            </p>
            <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-white/50">
              {data.briefSummary}
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
