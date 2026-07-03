import { RadioTower, Tags } from "lucide-react";

export function IntelligenceSidebar({ trendingCategories, sourceHealth = [] }) {
  const parliamentSources = sourceHealth.filter((source) =>
    ["digital-sansad", "lok-sabha", "rajya-sabha", "prs-india"].includes(
      source.key,
    ),
  );
  return (
    <div className="space-y-5">
      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-[#874047]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
            Live Parliament sources
          </p>
        </div>
        <div className="mt-4 space-y-2">
          {parliamentSources.map((source) => (
            <div
              key={source.key}
              className="flex items-center justify-between rounded-xl border border-[#8f1d2c]/8 bg-[#f6f2eb] px-3 py-2.5"
            >
              <span className="text-xs font-semibold text-[#514d46]">
                {source.label}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-[9px] font-semibold ${
                  ["Fresh", "Connected"].includes(source.status)
                    ? "bg-[#e2ece6] text-[#315a49]"
                    : "bg-[#f1e5d7] text-[#81552e]"
                }`}
              >
                {source.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-[#874047]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
            Trending policy areas
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {trendingCategories.length ? (
            trendingCategories.map((category) => (
              <span
                key={category.label}
                className="inline-flex items-center gap-2 rounded-full border border-[#8f1d2c]/10 bg-[#f6f2eb] px-3 py-2 text-xs font-medium text-[#514d46]"
              >
                {category.label}
                <span className="text-[10px] text-[#874047]">
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
    </div>
  );
}
