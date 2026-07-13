import {
  BookOpenText,
  FileCheck2,
  GitCompareArrows,
  MessageSquareText,
  NotebookPen,
  PanelsTopLeft,
  Bookmark,
  TimerReset,
} from "lucide-react";

export function ResearchActivity({ stats }) {
  const items = [
    {
      label: "Documents opened",
      value: stats.documentsOpened,
      icon: BookOpenText,
    },
    {
      label: "Policies opened",
      value: stats.policiesOpened,
      icon: FileCheck2,
    },
    {
      label: "Research sessions",
      value: stats.researchSessions,
      icon: TimerReset,
    },
    {
      label: "Research notes",
      value: stats.notesCreated,
      icon: NotebookPen,
    },
    {
      label: "Comparisons",
      value: stats.comparisonsCreated,
      icon: GitCompareArrows,
    },
    {
      label: "Saved documents",
      value: stats.savedDocuments,
      icon: Bookmark,
    },
    {
      label: "Research chats",
      value: stats.chatsCreated || stats.researchHistoryCount,
      icon: PanelsTopLeft,
    },
    {
      label: "Messages exchanged",
      value: stats.messagesExchanged || stats.totalMessages,
      icon: MessageSquareText,
    },
  ];

  return (
    <section id="research-activity" className="surface-card scroll-mt-24 p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
          Personal activity
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
          Your research activity
        </h2>
        <p className="mt-2 text-sm text-[#777066]">
          Counts come from your authenticated activity history and saved
          workspace data. Activity that was not tracked is not estimated.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
