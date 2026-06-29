import { ExternalLink } from "lucide-react";
import { humanize } from "@/lib/document-links";

export function RelatedDocuments({ relationships = [], recommendations = [] }) {
  const items = [
    ...relationships.map((item) => ({
      ...item.document,
      relation: item.relationshipType,
      verified: true,
    })),
    ...recommendations.map((item) => ({
      ...item,
      relation: "recommended",
      verified: false,
    })),
  ].slice(0, 10);
  return (
    <section>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
        Related documents
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <article
            key={`${item.verified}-${item.relation}-${item.id}`}
            className="rounded-xl border border-[#8f1d2c]/8 bg-white p-3"
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#874047]">
              {item.verified ? "Verified · " : "Suggested · "}
              {humanize(item.relation)}
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#29312d]">
              {item.title}
            </p>
            {(item.pdfUrl || item.sourceUrl) && (
              <a
                href={item.pdfUrl || item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#874047]"
              >
                Open
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </article>
        ))}
        {!items.length && (
          <p className="rounded-xl border border-dashed border-[#8f1d2c]/10 p-4 text-[11px] leading-5 text-[#81796e]">
            Related records will appear when catalogue relationships are
            verified.
          </p>
        )}
      </div>
    </section>
  );
}
