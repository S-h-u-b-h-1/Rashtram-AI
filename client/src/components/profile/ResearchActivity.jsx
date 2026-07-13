import {
  BookOpenCheck,
  FileStack,
  GitCompareArrows,
  MessagesSquare,
  NotebookPen,
  ScanSearch,
} from "lucide-react";

export function ResearchActivity({ stats }) {
  const items = [
    {
      label: "Documents opened",
      value: stats.documentsOpened,
      detail: "Unique documents in activity history",
      icon: BookOpenCheck,
    },
    {
      label: "Policies opened",
      value: stats.policiesOpened,
      detail: "Unique policy-class documents",
      icon: FileStack,
    },
    {
      label: "Research sessions",
      value: stats.researchSessions,
      detail: "Tracked research sessions",
      icon: ScanSearch,
    },
    {
      label: "Research notes",
      value: stats.notesCreated,
      detail: "Notes saved to your account",
      icon: NotebookPen,
    },
    {
      label: "Comparisons",
      value: stats.comparisonsCreated,
      detail: "Saved document comparisons",
      icon: GitCompareArrows,
    },
    {
      label: "Research messages",
      value: stats.totalMessages,
      detail: "Messages in active document threads",
      icon: MessagesSquare,
    },
  ];

  return (
    <section aria-labelledby="profile-activity-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
            Your activity
          </p>
          <h2 id="profile-activity-heading" className="mt-1 font-serif text-xl text-[#8f1d2c]">
            Research at a glance
          </h2>
        </div>
        <p className="text-[11px] text-[#81796e]">
          Account-derived metrics only
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => {
          const ActivityIcon = item.icon;
          return (
            <article
              key={item.label}
              className="group min-w-0 rounded-2xl border border-[#8f1d2c]/9 bg-[#fbf9f5] p-3.5 shadow-[0_12px_30px_rgba(27,37,33,0.035)] transition hover:-translate-y-0.5 hover:border-[#8f1d2c]/18 sm:p-4"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#eee5d9] text-[#874047]">
                <ActivityIcon className="h-4 w-4" />
              </div>
              <p className="mt-3 font-serif text-2xl leading-none text-[#8f1d2c] sm:text-[1.7rem]">
                {Number(item.value || 0).toLocaleString()}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold leading-4 text-[#514d46]">
                {item.label}
              </p>
              <p className="mt-1 hidden text-[9px] leading-4 text-[#91887d] sm:block xl:hidden 2xl:block">
                {item.detail}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
