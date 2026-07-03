"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { ContinueResearch } from "./ContinueResearch";
import { DashboardHero } from "./DashboardHero";
import { DocumentListSection } from "./DocumentListSection";
import { LegislativeUpdateGrid } from "./LegislativeUpdateGrid";
import { PlatformCoverageOverview } from "./PlatformCoverageOverview";
import { SourceHealthPanel } from "./SourceHealthPanel";
import { TrendingMinistries } from "./TrendingMinistries";
import { RecommendationSection } from "@/components/recommendations/RecommendationSection";
import { KnowledgeNetworkMetrics } from "./KnowledgeNetworkMetrics";

export function IntelligenceDashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let firstLoad = true;
    const loadDashboard = () =>
      api
        .getDashboardIntelligence()
        .then((intelligence) => {
          if (!active) return;
          setData(intelligence);
          setError("");
          if (firstLoad) {
            api.trackActivity({
              event_type: "dashboard_viewed",
              entity_type: "dashboard",
              page_path: "/app",
            });
          }
        })
        .catch(() => {
          if (active && firstLoad) {
            setError("The intelligence desk could not be loaded.");
          }
        })
        .finally(() => {
          if (active && firstLoad) {
            firstLoad = false;
            setLoading(false);
          }
        });
    loadDashboard();
    const refreshTimer = window.setInterval(loadDashboard, 60_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-5" aria-label="Loading intelligence dashboard">
        <div className="h-72 animate-pulse rounded-[1.8rem] bg-[#8f1d2c]/90" />
        <div className="h-96 animate-pulse rounded-[1.4rem] bg-white/55" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="surface-card grid min-h-[420px] place-items-center p-8 text-center">
        <div>
          <p className="font-serif text-2xl text-[#8f1d2c]">
            The intelligence desk is temporarily unavailable.
          </p>
          <p className="mt-2 text-sm text-[#85434a]">{error}</p>
          <button
            type="button"
            onClick={() => onNavigate("bills")}
            className="mt-5 rounded-full bg-[#8f1d2c] px-4 py-2.5 text-xs font-semibold text-white"
          >
            Open Bills
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-5">
      <DashboardHero
        data={data}
        onSearch={(query) =>
          window.location.assign(
            `/app?view=documents&q=${encodeURIComponent(query)}`,
          )
        }
      />

      <LegislativeUpdateGrid
        groups={[
          {
            label: "Parliament Bills",
            documents: data.activeBills || [],
            href: "/app?view=bills",
          },
          {
            label: "State Bills",
            documents: data.latestStateBills || [],
            href: "/app/state-bills",
          },
          {
            label: "Parliament Acts",
            documents: (data.latestActs || []).filter(
              (document) => document.jurisdictionLevel !== "state",
            ),
            href: "/app?view=acts",
          },
          {
            label: "State Acts",
            documents: (data.latestActs || []).filter(
              (document) => document.jurisdictionLevel === "state",
            ),
            href: "/app/state-acts",
          },
          {
            label: "Gazette Notifications",
            documents: data.recentGazetteNotifications || [],
            href: "/app/egazette",
          },
          {
            label: "Policies",
            documents: data.latestPolicies || [],
            href: "/app?view=policies",
          },
          {
            label: "Committee Reports",
            documents: data.committeeActivity || [],
            href: "/app?view=documents",
          },
        ]}
      />

      <PlatformCoverageOverview coverage={data.platformCoverage || {}} />

      <KnowledgeNetworkMetrics metrics={data.knowledgeGraph} />

      <ContinueResearch chats={data.recentUserChats || []} />

      {(data.recommendedReading || []).length > 0 && (
        <RecommendationSection
          eyebrow="High-confidence recommendations"
          title="Recommended reading"
          recommendations={data.recommendedReading}
          emptyMessage="No sufficiently supported policy recommendation is available yet."
          pagePath="/app"
        />
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <TrendingMinistries ministries={data.ministryActivity || []} />
        <DocumentListSection
          eyebrow="Policies, schemes and consultations"
          title="Recent policy updates"
          documents={data.latestPolicies || []}
          emptyMessage="No recent policy records are available from connected sources."
          onViewAll={() => onNavigate("policies")}
        />
      </div>

      <SourceHealthPanel sources={data.sourceHealth || []} compact />
    </div>
  );
}
