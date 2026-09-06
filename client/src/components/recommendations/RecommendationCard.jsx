"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  GitCompareArrows,
  Landmark,
  Loader2,
} from "lucide-react";
import {
  canPrepareForResearch,
  comparisonDisabledReason,
  comparisonHrefForDocuments,
  useComparison,
} from "@/context/ComparisonContext";
import { getDocumentReadiness, trackActivity } from "@/lib/api";
import { formatDate, humanize } from "@/lib/document-links";
import {
  compareActionState,
  recommendationReadinessLabel,
  recommendationResearchHref,
} from "./recommendation-utils.mjs";

export function RecommendationCard({
  recommendation,
  pagePath = "/app",
  compact = false,
  autoOpenComparison = false,
  onCompare,
}) {
  const router = useRouter();
  const {
    addDocument,
    prepareAndAddDocument,
    removeDocument,
    isSelected,
  } = useComparison();
  const [preparing, setPreparing] = useState(false);
  const [compareError, setCompareError] = useState("");
  const selected = isSelected(recommendation.id);
  const disabledReason = comparisonDisabledReason(recommendation);
  const canPrepare = canPrepareForResearch(recommendation);
  const confidence = recommendation.confidence || "medium";
  const needsReadinessCheck = recommendation.researchReady && Boolean(disabledReason) && !selected;
  const compareAction = compareActionState(
    canPrepare || needsReadinessCheck ? "" : disabledReason,
    selected,
  );
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
        <span className="rounded-full bg-[#f3ece4] px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#874047]">
          {documentType}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-[#eee0dc] px-2.5 py-1 text-xs font-bold capitalize text-[#8f1d2c]"
        >
          {recommendationReadinessLabel(recommendation, preparing)}
        </span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="[overflow-wrap:anywhere] text-sm font-semibold leading-6 text-[#29312d]">
            {recommendation.title}
          </h3>
        </div>
      </div>
      {metadata.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-[#81796e]">
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
      {(recommendation.authorityLabel || recommendation.priority) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#706a61]">
          {recommendation.authorityLabel && (
            <span className="rounded-full border border-[#8f1d2c]/10 bg-[#fffaf0] px-2 py-1">
              {recommendation.authorityLabel}
            </span>
          )}
          {recommendation.priority && (
            <span className="rounded-full border border-[#c1a06f]/30 bg-[#f7f2eb] px-2 py-1 capitalize">
              {recommendation.priority} reading
            </span>
          )}
        </div>
      )}
      {(!compact || recommendation.graphRelationship) && (
        <div className="mt-4 border-l-2 border-[#c1a06f]/55 pl-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#874047]">
            Why this matters
          </p>
          <p className="mt-1 text-xs leading-5 text-[#625d55]">
            {recommendation.whyThisMatters || recommendation.reason || "Recommended from your recent research context."}
          </p>
        </div>
      )}
      {recommendation.focusAreas?.length > 0 && (
        <p className="mt-3 text-xs leading-snug text-[#81796e]">
          <span className="font-bold uppercase tracking-[0.1em] text-[#874047]">What to focus on:</span>{" "}
          {recommendation.focusAreas.join(" · ")}
        </p>
      )}
      <p className="my-3 text-xs leading-5 text-[#706a61]">{recommendation.currentnessCaution || "Verify commencement, amendments and current applicability in the source."}</p>
      <div className="mt-auto flex flex-wrap gap-2 border-t border-[#8f1d2c]/7 pt-4">
        <Link
          href={recommendationResearchHref(recommendation)}
          onClick={() => track("recommendation_opened")}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8f1d2c] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#7d1826]"
        >
          {recommendation.researchReady ? "Research" : "Prepare for Research"}
          <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          disabled={compareAction.disabled || preparing}
          title={compareAction.disabled ? disabledReason : undefined}
          aria-pressed={selected}
          onClick={async () => {
            setPreparing(true);
            setCompareError("");
            try {
              if (needsReadinessCheck) {
                const readiness = await getDocumentReadiness(recommendation.id);
                if (!readiness.comparisonReady) {
                  setCompareError(readiness.reason || readiness.readinessReason || "This source is ready for research, but comparison retrieval is unavailable.");
                  return;
                }
                const verified = { ...recommendation, comparisonReady: true, researchReady: true, capabilities: { ...recommendation.capabilities, chatReady: true, comparisonReady: true } };
                const added = onCompare ? await onCompare(verified) : addDocument(verified);
                if (added?.ok === false) setCompareError(added.reason);
                return;
              }
              if (onCompare) {
                const result = await onCompare(recommendation);
                if (result?.ok !== false) track("recommendation_added_to_compare");
                return;
              }
              if (selected) {
                removeDocument(recommendation.id);
              } else {
                const result = canPrepare
                  ? await prepareAndAddDocument(recommendation)
                  : addDocument(recommendation);
                if (result.ok) {
                  track("recommendation_added_to_compare");
                  const href = autoOpenComparison
                    ? comparisonHrefForDocuments(result.documents)
                    : null;
                  if (href) router.push(href);
                } else {
                  setCompareError(
                    result.reason || "This document could not be prepared.",
                  );
                }
              }
            } catch (error) {
              setCompareError(
                error.message || "This document could not be prepared.",
              );
            } finally {
              setPreparing(false);
            }
          }}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#8f1d2c]/8 bg-[#eee0dc] px-3 py-2 text-xs font-semibold text-[#8f1d2c] transition hover:bg-[#e7d5cf] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {preparing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <GitCompareArrows className="h-3 w-3" />
          )}
          {preparing
            ? "Preparing…"
            : needsReadinessCheck ? "Check for comparison" : canPrepare
              ? "Prepare & compare"
              : onCompare ? "Compare" : compareAction.label}
        </button>
      </div>
      {compareAction.disabled && !selected && <p className="mt-2 text-xs leading-5 text-[#706a61]">{disabledReason}</p>}
      {compareError && (
        <p role="alert" className="mt-2 text-xs leading-snug text-[#8f1d2c]">
          {compareError}
        </p>
      )}
    </article>
  );
}
