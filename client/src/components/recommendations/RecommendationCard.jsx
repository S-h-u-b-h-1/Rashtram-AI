"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  GitCompareArrows,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import {
  comparisonDisabledReason,
  useComparison,
} from "@/context/ComparisonContext";
import { trackActivity } from "@/lib/api";
import { formatDate, humanize } from "@/lib/document-links";
import {
  compareActionState,
  recommendationResearchHref,
} from "./recommendation-utils.mjs";

export function RecommendationCard({
  recommendation,
  pagePath = "/app",
  compact = false,
}) {
  const { addDocument, removeDocument, isSelected } = useComparison();
  const selected = isSelected(recommendation.id);
  const disabledReason = comparisonDisabledReason(recommendation);
  const confidence = recommendation.confidence || "medium";
  const compareAction = compareActionState(disabledReason, selected);
  const documentType = humanize(
    recommendation.documentType || recommendation.type || "document",
  );
  const metadata = [
    recommendation.ministry || recommendation.authority,
    recommendation.state || recommendation.jurisdiction,
    recommendation.year ||
      (recommendation.publicationDate
        ? formatDate(recommendation.publicationDate)
        : null),
    recommendation.status,
  ].filter(Boolean);

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
    <article className="group flex h-full min-w-0 flex-col rounded-2xl border border-[#8f1d2c]/10 bg-white p-4 shadow-[0_10px_30px_rgba(45,31,27,0.055)] transition duration-200 hover:-translate-y-0.5 hover:border-[#8f1d2c]/20 hover:shadow-[0_16px_38px_rgba(45,31,27,0.09)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-[#f3ece4] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#874047]">
          {documentType}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-[#eee0dc] px-2.5 py-1 text-[9px] font-bold capitalize text-[#8f1d2c]"
          title={`${Math.round(Number(recommendation.score || 0) * 100)}% recommendation score`}
        >
          <ShieldCheck className="h-3 w-3" />
          {recommendation.researchReady
            ? `${confidence} · research ready`
            : `${confidence} · preparation required`}
        </span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-3 text-[15px] font-semibold leading-6 text-[#29312d]">
            {recommendation.title}
          </h3>
        </div>
      </div>
      {metadata.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-[#81796e]">
          {metadata.map((item, index) => (
            <span key={`${item}-${index}`} className="inline-flex min-w-0 items-center gap-1">
              {index === 0 ? (
                <Landmark className="h-3 w-3 shrink-0" />
              ) : (
                <CalendarDays className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">{item}</span>
            </span>
          ))}
        </div>
      )}
      {(!compact || recommendation.graphRelationship) && (
        <div className="mt-4 border-l-2 border-[#c1a06f]/55 pl-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#874047]">
            Why this matches
          </p>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#625d55]">
            {recommendation.reason || "Recommended from your recent research context."}
          </p>
        </div>
      )}
      {recommendation.signals?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recommendation.signals.slice(0, 4).map((signal) => (
            <span
              key={signal}
              className="rounded-full border border-[#8f1d2c]/6 bg-[#f7f2eb] px-2 py-1 text-[9px] font-medium text-[#706a61]"
            >
              {humanize(signal.replace(/([a-z])([A-Z])/g, "$1_$2"))}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 border-t border-[#8f1d2c]/7 pt-4">
        <Link
          href={recommendationResearchHref(recommendation)}
          onClick={() => track("recommendation_opened")}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8f1d2c] px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-[#7d1826]"
        >
          {recommendation.researchReady ? "Research" : "Prepare for Research"}
          <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          disabled={compareAction.disabled}
          title={compareAction.disabled ? disabledReason : undefined}
          aria-pressed={selected}
          onClick={() => {
            if (selected) {
              removeDocument(recommendation.id);
            } else {
              const result = addDocument(recommendation);
              if (result.ok) track("recommendation_added_to_compare");
            }
          }}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#8f1d2c]/8 bg-[#eee0dc] px-3 py-2 text-[10px] font-semibold text-[#8f1d2c] transition hover:bg-[#e7d5cf] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <GitCompareArrows className="h-3 w-3" />
          {compareAction.label}
        </button>
      </div>
    </article>
  );
}
