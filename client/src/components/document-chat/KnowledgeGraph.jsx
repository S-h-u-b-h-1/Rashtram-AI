import { Network } from "lucide-react";
import Link from "next/link";
import { humanize } from "@/lib/document-links";

export function KnowledgeGraph({ graph }) {
  if (!graph?.edges?.length) return null;
  const nodes = new Map(
    (graph.nodes || []).map((node) => [node.id, node]),
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
        {graph.edges.slice(0, 8).map((edge) => {
          const outgoing = edge.from === graph.rootId;
          const connectedId = outgoing ? edge.to : edge.from;
          const node = nodes.get(connectedId);
          const className = "block rounded-xl bg-[#f7f2eb] p-2.5";
          const content = (
            <>
              <p className="truncate text-[11px] font-semibold text-[#29312d]">
                {node?.label || connectedId}
              </p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-[#874047]">
                {outgoing ? "" : "Incoming · "}
                {humanize(edge.type)}
              </p>
            </>
          );
          return node?.document ? (
            <Link
              key={`${edge.from}-${edge.to}-${edge.type}`}
              href={`/app/document/${node.document.id}`}
              className={className}
            >
              {content}
            </Link>
          ) : (
            <div
              key={`${edge.from}-${edge.to}-${edge.type}`}
              className={className}
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
