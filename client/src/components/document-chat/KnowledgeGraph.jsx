import { Network } from "lucide-react";
import { humanize } from "@/lib/document-links";

export function KnowledgeGraph({ graph }) {
  if (!graph?.edges?.length) return null;
  const labels = new Map(
    (graph.nodes || []).map((node) => [node.id, node.label]),
  );
  return (
    <section className="rounded-2xl border border-[#8f1d2c]/8 bg-white p-4">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-[#8f1d2c]" />
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#514d46]">
          Knowledge graph
        </h3>
      </div>
      <div className="mt-3 space-y-2">
        {graph.edges.slice(0, 8).map((edge, index) => (
          <div
            key={`${edge.from}-${edge.to}-${index}`}
            className="rounded-xl bg-[#f7f2eb] p-2.5"
          >
            <p className="truncate text-[11px] font-semibold text-[#29312d]">
              {labels.get(edge.to) || edge.to}
            </p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-[#874047]">
              {humanize(edge.type)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
