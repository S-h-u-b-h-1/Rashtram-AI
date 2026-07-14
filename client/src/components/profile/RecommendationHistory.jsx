"use client";

import { AlertCircle, ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRecentRecommendations } from "@/lib/api";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import {
  PROFILE_RECOMMENDATION_GRID_CLASSES,
  RECOMMENDATION_FILTERS,
  deduplicateRecommendations,
  recommendationMatchesFilter,
} from "@/components/recommendations/recommendation-utils.mjs";

const INITIAL_VISIBLE_COUNT = 8;

function RecommendationSkeleton() {
  return (
    <div className="flex min-h-72 animate-pulse flex-col rounded-2xl border border-[#8f1d2c]/8 bg-white p-5">
      <div className="flex justify-between gap-3">
        <div className="h-5 w-20 rounded-full bg-[#eee7dd]" />
        <div className="h-5 w-28 rounded-full bg-[#eee7dd]" />
      </div>
      <div className="mt-5 h-5 w-full rounded bg-[#eee7dd]" />
      <div className="mt-2 h-5 w-3/4 rounded bg-[#eee7dd]" />
      <div className="mt-5 h-16 rounded-xl bg-[#f5efe7]" />
      <div className="mt-auto flex gap-2 pt-5">
        <div className="h-9 flex-1 rounded-xl bg-[#eadbd7]" />
        <div className="h-9 flex-1 rounded-xl bg-[#eee7dd]" />
      </div>
    </div>
  );
}

export function RecommendationHistory() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const requestSequence = useRef(0);

  const loadRecommendations = useCallback(() => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError("");
    getRecentRecommendations(30)
      .then((response) => {
        if (requestId === requestSequence.current) {
          setRecommendations(
            deduplicateRecommendations(response.recommendations || []),
          );
        }
      })
      .catch((requestError) => {
        if (requestId !== requestSequence.current) return;
        setRecommendations([]);
        setError(
          requestError?.message || "Recommendations could not be loaded.",
        );
      })
      .finally(
        () => requestId === requestSequence.current && setLoading(false),
      );
  }, []);

  useEffect(() => {
    loadRecommendations();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadRecommendations]);

  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        RECOMMENDATION_FILTERS.map((filter) => [
          filter.id,
          recommendations.filter((recommendation) =>
            recommendationMatchesFilter(recommendation, filter.id),
          ).length,
        ]),
      ),
    [recommendations],
  );
  const filteredRecommendations = useMemo(
    () =>
      recommendations.filter((recommendation) =>
        recommendationMatchesFilter(recommendation, activeFilter),
      ),
    [activeFilter, recommendations],
  );
  const visibleRecommendations = showAll
    ? filteredRecommendations
    : filteredRecommendations.slice(0, INITIAL_VISIBLE_COUNT);
  const canExpand = filteredRecommendations.length > INITIAL_VISIBLE_COUNT;

  return (
    <section className="surface-card min-w-0 overflow-hidden" aria-labelledby="profile-recommendations-title">
      <div className="border-b border-[#8f1d2c]/8 bg-[linear-gradient(135deg,#fbf9f5_0%,#f2e9df_100%)] p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[#874047]">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#eee0dc]">
                <Sparkles className="h-4 w-4" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]">
                Grounded recommendations
              </p>
            </div>
            <h2 id="profile-recommendations-title" className="mt-3 font-serif text-2xl text-[#8f1d2c] sm:text-3xl">
              Recommended based on your research
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#777066]">
              Continue with evidence-backed documents connected to your recent research, comparisons, and saved preferences.
            </p>
          </div>
          {!loading && !error && canExpand && (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-xs font-semibold text-[#8f1d2c] shadow-sm transition hover:bg-[#fffaf5]"
            >
              {showAll ? "Show fewer" : "View all recommendations"}
              <ArrowRight className={`h-3.5 w-3.5 transition ${showAll ? "rotate-90" : ""}`} />
            </button>
          )}
        </div>

        {!loading && !error && recommendations.length > 0 && (
          <div className="app-scrollbar -mx-1 mt-5 flex max-w-full gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter recommendations">
            {RECOMMENDATION_FILTERS.map((filter) => {
              const count = filterCounts[filter.id] || 0;
              const disabled = filter.id !== "all" && count === 0;
              const selected = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  title={disabled ? `No recommendations include ${filter.label.toLowerCase()} metadata.` : undefined}
                  onClick={() => {
                    setActiveFilter(filter.id);
                    setShowAll(false);
                  }}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? "border-[#8f1d2c] bg-[#8f1d2c] text-white"
                      : "border-[#8f1d2c]/10 bg-white text-[#706a61] hover:border-[#8f1d2c]/25 hover:text-[#8f1d2c]"
                  }`}
                >
                  {filter.label}
                  <span className={selected ? "text-white/65" : "text-[#9a9185]"}>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-w-0 p-4 sm:p-6 lg:p-7">
      {loading ? (
        <div className={PROFILE_RECOMMENDATION_GRID_CLASSES} aria-label="Loading recommendations" aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => <RecommendationSkeleton key={index} />)}
        </div>
      ) : error ? (
        <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-[#8f1d2c]/16 bg-[#faf6f0] p-6 text-center">
          <div className="max-w-md">
            <AlertCircle className="mx-auto h-6 w-6 text-[#8f1d2c]" />
            <h3 className="mt-3 text-sm font-semibold text-[#29312d]">Recommendations are temporarily unavailable</h3>
            <p className="mt-2 text-xs leading-5 text-[#81796e]">{error}</p>
            <button type="button" onClick={loadRecommendations} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#8f1d2c] px-4 text-xs font-semibold text-white transition hover:bg-[#7d1826]">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </div>
      ) : recommendations.length ? (
        visibleRecommendations.length ? (
          <div className={PROFILE_RECOMMENDATION_GRID_CLASSES} data-testid="profile-recommendation-grid">
          {visibleRecommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.documentId || recommendation.id || recommendation.recommendationId}
              recommendation={recommendation}
              pagePath="/app/profile"
            />
          ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#8f1d2c]/14 bg-[#faf6f0] p-6 text-center">
            <p className="text-sm font-semibold text-[#29312d]">No recommendations match this filter.</p>
            <button type="button" onClick={() => setActiveFilter("all")} className="mt-3 text-xs font-semibold text-[#8f1d2c] underline decoration-[#8f1d2c]/30 underline-offset-4">Clear filter</button>
          </div>
        )
      ) : (
        <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-[#8f1d2c]/14 bg-[#faf6f0] p-6 text-center">
          <div className="max-w-md">
            <Sparkles className="mx-auto h-6 w-6 text-[#a85a52]" />
            <h3 className="mt-3 text-sm font-semibold text-[#29312d]">Build your recommendation trail</h3>
            <p className="mt-2 text-xs leading-5 text-[#81796e]">Research or compare a document and grounded recommendations will appear here.</p>
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
