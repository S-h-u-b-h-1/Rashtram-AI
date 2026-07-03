import { DatabaseZap } from "lucide-react";

export function ResearchReadinessMetrics({ metrics }) {
  if (!metrics) return null;
  const duration = (milliseconds) => {
    const seconds = Math.round(Number(milliseconds || 0) / 1_000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };
  const values = [
    ["Research ready", metrics.researchReady],
    ["Comparison ready", metrics.comparisonReady],
    ["Processing backlog", metrics.processableBacklog],
    ["Stored passages", metrics.chunks],
    ["Queued", metrics.queue?.queued],
    ["Processing", metrics.queue?.running],
    ["Failed / DLQ", (metrics.queue?.failed || 0) + (metrics.queue?.deadLetter || 0)],
    ["Throughput / hour", metrics.performance?.throughputPerHour],
  ];
  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
            Research infrastructure
          </p>
          <h2 className="mt-1 font-serif text-2xl text-[#8f1d2c]">
            Processing readiness
          </h2>
        </div>
        <DatabaseZap className="h-6 w-6 text-[#8f1d2c]" />
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {values.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[#f7f2eb] p-4">
            <dt className="text-[9px] uppercase tracking-[0.12em] text-[#81796e]">
              {label}
            </dt>
            <dd className="mt-2 font-serif text-2xl text-[#29312d]">
              {Number(value || 0).toLocaleString("en-IN")}
            </dd>
          </div>
        ))}
      </dl>
      {metrics.performance && (
        <div className="mt-4 grid gap-3 rounded-xl border border-[#8f1d2c]/8 bg-[#fffaf0] p-4 text-xs text-[#706a61] sm:grid-cols-2 xl:grid-cols-4">
          <p>
            Average processing{" "}
            <strong className="text-[#29312d]">
              {duration(metrics.performance.averageDurationMs)}
            </strong>
          </p>
          <p>
            Failure rate{" "}
            <strong className="text-[#29312d]">
              {(Number(metrics.performance.failureRate || 0) * 100).toFixed(1)}%
            </strong>
          </p>
          <p>
            Active workers{" "}
            <strong className="text-[#29312d]">
              {(metrics.workers || []).filter(
                (worker) => worker.status === "running",
              ).length}
            </strong>
          </p>
          <p>
            Estimated completion{" "}
            <strong className="text-[#29312d]">
              {metrics.performance.estimatedCompletionHours == null
                ? "Awaiting throughput"
                : `${metrics.performance.estimatedCompletionHours.toLocaleString(
                  "en-IN",
                )}h`}
            </strong>
          </p>
        </div>
      )}
      {(metrics.latestProcessed || []).length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-[#514d46]">
            Latest processed documents
          </h3>
          <ul className="mt-2 grid gap-2 lg:grid-cols-2">
            {metrics.latestProcessed.slice(0, 6).map((item) => (
              <li
                key={item.documentId}
                className="rounded-xl bg-[#fffaf0] p-3 text-xs text-[#706a61]"
              >
                {item.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
