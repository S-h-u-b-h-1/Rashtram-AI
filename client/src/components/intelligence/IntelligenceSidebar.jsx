import {
  BellRing,
  CalendarDays,
  ChevronRight,
  Tags,
} from "lucide-react";

export function IntelligenceSidebar({ trendingCategories }) {
  return (
    <div className="space-y-5">
      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#9f4937]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9e4937]">
            Parliamentary calendar
          </p>
        </div>
        <h2 className="mt-3 font-serif text-2xl text-[#c30000]">
          Business & committee agenda
        </h2>
        <div className="mt-5 rounded-2xl border border-dashed border-[#c30000]/14 bg-[#f7f2e8] p-5">
          <p className="text-sm font-semibold text-[#3c443f]">
            Calendar feed planned
          </p>
          <p className="mt-2 text-xs leading-5 text-[#7d756b]">
            Parliamentary business and committee calendar feeds are not
            connected yet. No agenda entries are being inferred.
          </p>
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-[#9f4937]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9e4937]">
            Trending policy areas
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {trendingCategories.length ? (
            trendingCategories.map((category) => (
              <span
                key={category.label}
                className="inline-flex items-center gap-2 rounded-full border border-[#c30000]/10 bg-[#fffdf8] px-3 py-2 text-xs font-medium text-[#514d46]"
              >
                {category.label}
                <span className="text-[10px] text-[#9f4937]">
                  {category.documentCount}
                </span>
              </span>
            ))
          ) : (
            <p className="text-sm text-[#7d756b]">
              Categories will appear when source metadata is available.
            </p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.4rem] border border-[#c30000]/10 bg-[#e9dfd0] p-5 sm:p-6">
        <BellRing className="h-5 w-5 text-[#9f4937]" />
        <h2 className="mt-4 font-serif text-2xl text-[#c30000]">
          Build your watchlist
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#6f685f]">
          Track a Bill, ministry, topic, source, or state.
        </p>
        <button
          type="button"
          disabled
          className="mt-5 inline-flex cursor-not-allowed items-center gap-1 text-xs font-semibold text-[#8a8277]"
        >
          Coming soon
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </section>
    </div>
  );
}
