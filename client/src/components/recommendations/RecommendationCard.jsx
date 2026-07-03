"use client";

import Link from "next/link";
import {
  ArrowRight,
  GitCompareArrows,
  ShieldCheck,
} from "lucide-react";
import {
  comparisonDisabledReason,
  useComparison,
} from "@/context/ComparisonContext";
import { trackActivity } from "@/lib/api";
import { formatDate, humanize } from "@/lib/document-links";

export function RecommendationCard({
  recommendation,
  pagePath = "/app",
  compact = false,
}) {
  const { addDocument, removeDocument, isSelected } = useComparison();
  const selected = isSelected(recommendation.id);
  const disabledReason = comparisonDisabledReason(recommendation);
  const confidence = recommendation.confidence || "medium";

  const track = (eventType) =>
    trackActivity({
      event_type: eventType,
      entity_type: "recommendation",
      entity_id: recommendation.recommendationId || recommendation.id,
      document_id: recommendation.id,
      page_path: pagePath,
      metadata_json: {
        confidence,
        score: recommendation.score,
        recommendationType: recommendation.recommendationType,
        category: recommendation.category,
        ministry: recommendation.ministry,
        jurisdiction: recommendation.jurisdiction,
        documentType:
          recommendation.documentType || recommendation.type,
      },
    });

  return (
    <article className="rounded-2xl border border-[#8f1d2c]/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#874047]">
            {humanize(
              recommendation.documentType || recommendation.type,
            )}{" "}
            · {confidence} confidence
          </p>
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-[#29312d]">
            {recommendation.title}
          </h3>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eee0dc] px-2 py-1 text-[9px] font-bold text-[#8f1d2c]">
          <ShieldCheck className="h-3 w-3" />
          {Math.round(Number(recommendation.score || 0) * 100)}%
        </span>
      </div>
      <p className="mt-2 text-[10px] text-[#81796e]">
        {[recommendation.ministry || recommendation.authority,
          recommendation.state || recommendation.jurisdiction,
          recommendation.year || formatDate(recommendation.publicationDate)]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {(!compact || recommendation.graphRelationship) && (
        <p className="mt-3 text-xs leading-5 text-[#625d55]">
          {recommendation.reason}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/app/document/${recommendation.id}`}
          onClick={() => track("recommendation_opened")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#8f1d2c] px-3 py-2 text-[10px] font-semibold text-white"
        >
          Research
          <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          disabled={Boolean(disabledReason)}
          title={disabledReason || undefined}
          onClick={() => {
            if (selected) {
              removeDocument(recommendation.id);
            } else {
              const result = addDocument(recommendation);
              if (result.ok) track("recommendation_added_to_compare");
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#eee0dc] px-3 py-2 text-[10px] font-semibold text-[#8f1d2c] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <GitCompareArrows className="h-3 w-3" />
          {selected ? "Remove compare" : "Add to compare"}
        </button>
      </div>
    </article>
  );
}
