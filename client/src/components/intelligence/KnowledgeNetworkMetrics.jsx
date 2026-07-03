import { Network } from "lucide-react";
import Link from "next/link";

export function KnowledgeNetworkMetrics({ metrics }) {
  if (!metrics) return null;
  const cards = [
    ["Connected documents", metrics.connectedDocuments],
    ["Verified relationships", metrics.relationships],
    ["Graph coverage", `${metrics.coveragePercent}%`],
    ["New relationships", metrics.newRelationships],
  ];
  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
            Government Knowledge Network
          </p>
          <h2 className="mt-1 font-serif text-2xl text-[#8f1d2c]">
            Relationship intelligence
          </h2>
        </div>
        <Network className="h-6 w-6 text-[#8f1d2c]" />
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[#f7f2eb] p-4">
            <dt className="text-[9px] uppercase tracking-[0.12em] text-[#81796e]">
              {label}
            </dt>
            <dd className="mt-2 font-serif text-2xl text-[#29312d]">
              {Number.isFinite(value) ? value.toLocaleString() : value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold text-[#514d46]">
            Top connected ministries
          </h3>
          <ul className="mt-2 space-y-2">
            {(metrics.topConnectedMinistries || []).map((item) => (
              <li
                key={item.ministry}
                className="flex justify-between gap-3 text-xs text-[#706a61]"
              >
                <span>{item.ministry}</span>
                <span>{item.relationships.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-[#514d46]">
            Most amended Acts
          </h3>
          <ul className="mt-2 space-y-2">
            {(metrics.mostAmendedActs || []).map((item) => (
              <li key={item.id}>
                <Link
                  href={`/app/graph/${item.id}`}
                  className="flex justify-between gap-3 text-xs text-[#706a61] hover:text-[#8f1d2c]"
                >
                  <span>{item.title}</span>
                  <span>{item.amendmentCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
