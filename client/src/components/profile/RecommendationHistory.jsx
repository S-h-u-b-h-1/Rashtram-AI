"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { getRecentRecommendations } from "@/lib/api";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";

export function RecommendationHistory() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getRecentRecommendations(12)
      .then((response) => {
        if (active) setRecommendations(response.recommendations || []);
      })
      .catch(() => active && setRecommendations([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#874047]" />
        <h2 className="font-serif text-2xl text-[#8f1d2c]">
          Recommended based on your research
        </h2>
      </div>
      {loading ? (
        <Loader2 className="mt-5 h-5 w-5 animate-spin text-[#8f1d2c]" />
      ) : recommendations.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              pagePath="/app/profile"
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#81796e]">
          Grounded recommendations will appear after you research or compare
          documents.
        </p>
      )}
    </section>
  );
}
