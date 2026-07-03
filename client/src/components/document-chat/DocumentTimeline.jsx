import { Clock3 } from "lucide-react";
import { formatDate, humanize } from "@/lib/document-links";

export function DocumentTimeline({ events = [] }) {
  if (!events.length) return null;
  return (
    <section className="rounded-2xl border border-[#8f1d2c]/8 bg-white p-4">
      <div className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-[#8f1d2c]" />
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#514d46]">
          Legal timeline
        </h3>
      </div>
      <ol className="mt-3 space-y-3 border-l border-[#8f1d2c]/15 pl-4">
        {events.map((event, index) => (
          <li key={`${event.type}-${event.date}-${index}`}>
            <p className="text-xs font-semibold text-[#29312d]">
              {event.label || humanize(event.type)}
            </p>
            <p className="mt-0.5 text-[10px] text-[#777066]">
              {formatDate(event.date)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
