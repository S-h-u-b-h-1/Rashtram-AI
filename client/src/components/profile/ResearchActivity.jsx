import {
  BookOpenText,
  FileCheck2,
  FolderOpen,
  History,
  MessageSquareText,
  ScrollText,
  Newspaper,
  Clock3,
  Flame,
  Search,
  CalendarRange,
} from "lucide-react";

export function ResearchActivity({ stats }) {
  const items = [
    {
      label: "Bill conversations",
      value: stats.billChats,
      icon: ScrollText,
    },
    {
      label: "Act conversations",
      value: stats.actChats,
      icon: BookOpenText,
    },
    {
      label: "Policy conversations",
      value: stats.policyChats,
      icon: FileCheck2,
    },
    {
      label: "Gazette conversations",
      value: stats.gazetteChats,
      icon: Newspaper,
    },
    {
      label: "Gazette documents opened",
      value: stats.gazetteDocumentsOpened,
      icon: FolderOpen,
    },
    {
      label: "Research history",
      value: stats.researchHistoryCount,
      icon: History,
    },
    {
      label: "Documents opened",
      value: stats.documentsOpened,
      icon: FolderOpen,
    },
    {
      label: "Saved summaries",
      value: stats.savedSummaries,
      icon: FileCheck2,
    },
    {
      label: "Research messages",
      value: stats.totalMessages,
      icon: MessageSquareText,
    },
    {
      label: "Research sessions",
      value: stats.researchSessions,
      icon: History,
    },
    {
      label: "Recent searches",
      value: stats.recentSearches,
      icon: Search,
    },
    {
      label: "Reading minutes",
      value: stats.readingTimeMinutes,
      icon: Clock3,
    },
    {
      label: "Research streak",
      value: stats.researchStreak,
      suffix: " days",
      icon: Flame,
    },
    {
      label: "Weekly activity",
      value: stats.weeklyActivity,
      icon: CalendarRange,
    },
    {
      label: "Monthly activity",
      value: stats.monthlyActivity,
      icon: CalendarRange,
    },
  ];

  return (
    <section className="surface-card p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
          Personal activity
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
          Your research activity
        </h2>
        <p className="mt-2 text-sm text-[#777066]">
          These numbers reflect only your own saved research.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {items.map((item) => {
          const ActivityIcon = item.icon;
          return (
            <article
              key={item.label}
              className="rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4"
            >
              <ActivityIcon className="h-4 w-4 text-[#874047]" />
              <p className="mt-4 font-serif text-3xl text-[#8f1d2c]">
                {Number(item.value || 0).toLocaleString()}
                {item.suffix || ""}
              </p>
              <p className="mt-1 text-[11px] text-[#81796e]">
                {item.label}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
