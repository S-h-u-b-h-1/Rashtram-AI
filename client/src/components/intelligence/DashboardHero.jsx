import {
  Activity,
  BookOpenCheck,
  Clock3,
  RadioTower,
  Scale,
} from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/document-links";

export function DashboardHero({ data }) {
  const metrics = [
    {
      label: "Verified feed items",
      value: data.intelligenceEvents.length,
      icon: RadioTower,
    },
    {
      label: "Active Bills",
      value: data.activeBills.length,
      icon: Activity,
    },
    {
      label: "Legal updates",
      value: data.latestLegalUpdates.length,
      icon: Scale,
    },
    {
      label: "Continue research",
      value: data.recentUserChats.length,
      icon: BookOpenCheck,
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-[1.8rem] bg-[#19231f] p-6 text-white sm:p-8 lg:p-10">
      <div className="policy-grid absolute inset-0 opacity-20" />
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#d97745]/18 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
              <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 font-semibold uppercase tracking-[0.14em] text-[#efb36f]">
                Parliament Intelligence Brief
              </span>
              <span>{formatDate(data.currentDate)}</span>
            </div>
            <h2 className="mt-5 font-serif text-3xl leading-tight tracking-[-0.035em] sm:text-5xl">
              {data.userGreeting}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">
              {data.briefSummary}
            </p>
            <p className="mt-4 border-l-2 border-[#efb36f]/70 pl-4 text-sm leading-6 text-white/82">
              {data.whatChangedRecently}
            </p>
          </div>

          <div className="min-w-[230px] rounded-2xl border border-white/10 bg-white/[0.055] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/82">
              <Clock3 className="h-4 w-4 text-[#efb36f]" />
              Source freshness
            </div>
            <p className="mt-3 font-serif text-2xl">
              {data.freshnessStatus.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/42">
              Last refresh {formatRelativeTime(data.lastRefresh)}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((metric) => {
            const MetricIcon = metric.icon;
            return (
              <div
                key={metric.label}
                className="rounded-2xl border border-white/9 bg-white/[0.045] p-4"
              >
                <MetricIcon className="h-4 w-4 text-[#efb36f]" />
                <p className="mt-4 font-serif text-3xl">{metric.value}</p>
                <p className="mt-1 text-[11px] text-white/42">
                  {metric.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
