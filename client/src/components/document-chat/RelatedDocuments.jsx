import { ExternalLink, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { humanize } from "@/lib/document-links";

export function RelatedDocuments({
  relationships = [],
  recommendations = [],
  relatedChats = [],
}) {
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
            {(item.id || item.pdfUrl || item.sourceUrl) && (
              <Link
                href={
                  item.id && item.readiness !== "processing_failed"
                    ? `/app/document/${item.id}`
                    : item.pdfUrl || item.sourceUrl
                }
                target={
                  item.id && item.readiness !== "processing_failed"
                    ? undefined
                    : "_blank"
                }
                rel={
                  item.id && item.readiness !== "processing_failed"
                    ? undefined
                    : "noreferrer"
                }
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#874047]"
              >
                {item.researchReady
                  ? "Research"
                  : item.id && item.pdfUrl
                    ? "Prepare research"
                  : item.pdfUrl
                    ? "View PDF"
                    : "View source"}
                <ExternalLink className="h-3 w-3" />
              </Link>
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
      {relatedChats.length > 0 && (
        <div className="mt-5 border-t border-[#8f1d2c]/8 pt-4">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
            <MessageSquareText className="h-3.5 w-3.5" />
            Related research
          </p>
          <div className="mt-3 space-y-2">
            {relatedChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/app/document/${chat.documentId}`}
                className="block rounded-xl border border-[#8f1d2c]/8 bg-white p-3 hover:bg-[#fbf8f2]"
              >
                <p className="text-xs font-semibold leading-5 text-[#29312d]">
                  {chat.title}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-[#874047]">
                  {humanize(chat.documentType)} research chat
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
