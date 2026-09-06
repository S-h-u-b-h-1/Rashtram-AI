"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RecommendationCard } from "./RecommendationCard";
import { trackActivity } from "@/lib/api";

export function RecommendationSection({
  title = "Related documents to refer",
  eyebrow = "Grounded recommendations",
  recommendations = [],
  pagePath = "/app",
  emptyMessage = "No sufficiently supported recommendations are available yet.",
}) {
  const trackedIds = useRef(new Set());
  const [showMore, setShowMore] = useState(false);
  const primary = useMemo(
    () =>
      recommendations.filter(
        (recommendation) => recommendation.confidence !== "low",
      ),
    [recommendations],
  );
  const lowerConfidence = useMemo(
    () =>
      recommendations.filter(
        (recommendation) => recommendation.confidence === "low",
      ),
    [recommendations],
  );
  const visibleRecommendations = useMemo(
    () => (showMore ? recommendations : primary),
    [primary, recommendations, showMore],
  );

  useEffect(() => {
    visibleRecommendations.slice(0, 10).forEach((recommendation) => {
      const trackingId = String(
        recommendation.recommendationId || recommendation.id,
      );
      if (trackedIds.current.has(trackingId)) return;
      trackedIds.current.add(trackingId);
      trackActivity({
        event_type: "recommendation_viewed",
        entity_type: "recommendation",
        entity_id: recommendation.recommendationId || recommendation.id,
        document_id: recommendation.id,
        page_path: pagePath,
        metadata_json: {
          confidence: recommendation.confidence,
          score: recommendation.score,
          recommendationType: recommendation.recommendationType,
          documentType:
            recommendation.documentType || recommendation.type,
          ministry: recommendation.ministry,
          jurisdiction: recommendation.jurisdiction,
        },
      });
    });
  }, [pagePath, visibleRecommendations]);

  return (
    <section className="surface-card p-5 sm:p-6">
      {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
        {eyebrow}
      </p>}
      <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">{title}</h2>
      {primary.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {primary.slice(0, 10).map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              pagePath={pagePath}
            />
          ))}
        </div>
      ) : emptyMessage && !lowerConfidence.length ? (
        <p className="mt-3 rounded-xl border border-dashed border-[#8f1d2c]/12 p-4 text-sm text-[#81796e]">
          {emptyMessage}
        </p>
      ) : null}
      {lowerConfidence.length > 0 && <details className="mt-4" onToggle={event => setShowMore(event.currentTarget.open)}>
        <summary className="cursor-pointer py-3 text-sm font-semibold text-[#625d55]">Related / lower-confidence sources ({lowerConfidence.length})</summary>
        <p className="my-3 text-xs leading-5 text-[#706a61]">Optional context, not evidence of applicability or official requirements.</p>
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">{lowerConfidence.slice(0, 10).map(recommendation => <RecommendationCard key={recommendation.id} recommendation={recommendation} pagePath={pagePath} />)}</div>
      </details>}
    </section>
  );
}
