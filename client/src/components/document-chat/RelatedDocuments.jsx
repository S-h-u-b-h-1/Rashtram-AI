"use client";

import {
  ExternalLink,
  GitCompareArrows,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import { humanize } from "@/lib/document-links";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import { useComparison } from "@/context/ComparisonContext";

export function RelatedDocuments({
  sourceDocumentType,
  relationships = [],
  recommendations = [],
  relatedChats = [],
}) {
  const { addDocument, isSelected, removeDocument } = useComparison();
  const items = relationships.slice(0, 6).map((item) => ({
    ...item.document,
    relation: item.relationshipType,
    explanation: item.explanation,
    confidence: item.confidence,
    verified: true,
  }));
  return (
    <section>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
        {sourceDocumentType === "bill"
          ? "Related Bills"
          : "Related documents to refer"}
      </p>
      {recommendations.length > 0 && (
        <div className="mt-3 space-y-3">
          {recommendations.slice(0, 6).map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              pagePath={`/app/document/${recommendation.id}`}
              compact
            />
          ))}
        </div>
      )}
      {items.length > 0 && (
        <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#81796e]">
          Verified catalogue relationships
        </p>
      )}
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <article
            key={`${item.verified}-${item.relation}-${item.id}`}
            className="rounded-xl border border-[#8f1d2c]/8 bg-white p-3"
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#874047]">
              Verified · {humanize(item.relation)}
              {item.confidence != null
                ? ` · ${Math.round(item.confidence * 100)}%`
                : ""}
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#29312d]">
              {item.title}
            </p>
            {item.explanation && (
              <p className="mt-2 text-[10px] leading-5 text-[#706a61]">
                {item.explanation}
              </p>
            )}
            {(item.id || item.pdfUrl || item.sourceUrl) && (
              <div className="mt-2 flex flex-wrap gap-2">
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
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#874047]"
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
                {item.researchReady && (
                  <button
                    type="button"
                    onClick={() =>
                      isSelected(item.id)
                        ? removeDocument(item.id)
                        : addDocument(item)
                    }
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#874047]"
                  >
                    <GitCompareArrows className="h-3 w-3" />
                    {isSelected(item.id)
                      ? "Remove compare"
                      : "Add to compare"}
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
        {!items.length && !recommendations.length && (
          <p className="rounded-xl border border-dashed border-[#8f1d2c]/10 p-4 text-[11px] leading-5 text-[#81796e]">
            {sourceDocumentType === "bill"
              ? "No closely related Bills are available yet."
              : "Related records will appear when catalogue relationships are verified."}
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
