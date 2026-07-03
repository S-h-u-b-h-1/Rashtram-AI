import { Network, Route } from "lucide-react";
import Link from "next/link";

export function GraphResearchJourneys({ insights }) {
  if (!insights) return null;
  const hasContent =
    insights.savedPaths?.length ||
    insights.mostExploredNodes?.length ||
    insights.mostExploredMinistries?.length;
  if (!hasContent) return null;
  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-[#8f1d2c]" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
            Knowledge graph activity
          </p>
          <h2 className="mt-1 font-serif text-2xl text-[#8f1d2c]">
            Research journeys
          </h2>
        </div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div>
          <h3 className="text-xs font-semibold text-[#514d46]">
            Explored ministries
          </h3>
          <ul className="mt-2 space-y-2 text-xs text-[#706a61]">
            {(insights.mostExploredMinistries || []).map((item) => (
              <li key={item.label} className="flex justify-between gap-2">
                <span>{item.label}</span>
                <span>{item.explorations}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-[#514d46]">
            Explored topics
          </h3>
          <ul className="mt-2 space-y-2 text-xs text-[#706a61]">
            {(insights.mostExploredTopics || []).map((item) => (
              <li key={item.label} className="flex justify-between gap-2">
                <span>{item.label}</span>
                <span>{item.explorations}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-[#514d46]">
            Most explored nodes
          </h3>
          <ul className="mt-2 space-y-2">
            {(insights.mostExploredNodes || []).map((item) => (
              <li key={item.documentId}>
                <Link
                  href={`/app/graph/${item.documentId}`}
                  className="flex justify-between gap-2 text-xs text-[#706a61] hover:text-[#8f1d2c]"
                >
                  <span>{item.title}</span>
                  <span>{item.explorations}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {(insights.savedPaths || []).length > 0 && (
        <div className="mt-6 border-t border-[#8f1d2c]/8 pt-5">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-[#8f1d2c]" />
            <h3 className="text-xs font-semibold text-[#514d46]">
              Saved graph paths
            </h3>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {insights.savedPaths.map((item) => (
              <Link
                key={item.id}
                href={`/app/graph/${item.sourceDocumentId}`}
                className="rounded-xl bg-[#f7f2eb] p-3 text-xs font-semibold text-[#514d46]"
              >
                {item.title || "Saved relationship path"}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
