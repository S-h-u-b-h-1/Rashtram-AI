"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { ContinueResearch } from "./ContinueResearch";
import { DashboardHero } from "./DashboardHero";
import { DocumentListSection } from "./DocumentListSection";
import { IntelligenceFeed } from "./IntelligenceFeed";
import { IntelligenceSidebar } from "./IntelligenceSidebar";
import { SourceHealthPanel } from "./SourceHealthPanel";
import { MajorDevelopments } from "./MajorDevelopments";
import { MinistryActivity } from "./MinistryActivity";

export function IntelligenceDashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadDashboard = async () => {
      try {
        const intelligence = await api.getDashboardIntelligence();
        if (!controller.signal.aborted) {
          setData(intelligence);
          api.trackActivity({
            event_type: "dashboard_viewed",
            entity_type: "dashboard",
            page_path: "/app",
          });
        }
      } catch (requestError) {
        console.error("Failed to load legislative intelligence:", requestError);
        if (!controller.signal.aborted) {
          setError(
            "The intelligence desk could not be loaded. Your Bills and Acts remain available.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadDashboard();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="space-y-5" aria-label="Loading intelligence dashboard">
        <div className="h-80 animate-pulse rounded-[1.8rem] bg-[#8f1d2c]/90" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
          <div className="h-[520px] animate-pulse rounded-[1.4rem] bg-white/55" />
          <div className="h-[520px] animate-pulse rounded-[1.4rem] bg-white/55" />
        </div>
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
          <p className="mt-2 max-w-md text-sm leading-6 text-[#85434a]">
            {error}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate("bills")}
              className="rounded-full bg-[#8f1d2c] px-4 py-2.5 text-xs font-semibold text-white"
            >
              Open Bills
            </button>
            <button
              type="button"
              onClick={() => onNavigate("acts")}
              className="rounded-full border border-[#8f1d2c]/12 px-4 py-2.5 text-xs font-semibold text-[#8f1d2c]"
            >
              Open Acts
            </button>
          </div>
        </div>
      </div>
    );
  }

  const parliamentEvents = data.intelligenceEvents.filter((event) =>
    ["digital-sansad", "lok-sabha", "rajya-sabha", "prs-india"].includes(
      event.sourceName,
    ),
  );

  return (
    <div className="space-y-5 pb-5">
      <DashboardHero data={data} />
      <MajorDevelopments developments={data.majorDevelopments || []} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,0.75fr)]">
        <IntelligenceFeed
          events={parliamentEvents}
          isFallback={
            data.emptyStateFlags.noLiveEvents || parliamentEvents.length === 0
          }
        />
        <IntelligenceSidebar
          trendingCategories={data.trendingCategories}
          sourceHealth={data.sourceHealth}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DocumentListSection
          eyebrow="Legislative pipeline"
          title="Latest Bills"
          documents={data.activeBills}
          emptyMessage="No Bills with a safely identified active status are currently available."
          onViewAll={() => onNavigate("bills")}
        />
        <DocumentListSection
          eyebrow="Law & Gazette"
          title="Latest legal updates"
          documents={data.latestLegalUpdates}
          emptyMessage="No recent Acts, rules, notifications, or Gazettes are available."
          onViewAll={() => onNavigate("acts")}
        />
      </div>

      <DocumentListSection
        eyebrow="Official Gazette"
        title="Recent Gazette notifications"
        documents={data.recentGazetteNotifications || []}
        emptyMessage="No recent Gazette notifications are currently stored."
        onViewAll={() => onNavigate("egazette")}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <MinistryActivity ministries={data.ministryActivity || []} />
        <DocumentListSection
          eyebrow="Personalized from your preferences"
          title="Recommended reading"
          documents={data.recommendedReading || []}
          emptyMessage="Add research interests in your profile to improve recommendations."
        />
      </div>

      <ContinueResearch chats={data.recentUserChats} />
      <SourceHealthPanel sources={data.sourceHealth} />

      <DocumentListSection
        eyebrow="Catalogue arrivals"
        title="Recently added documents"
        documents={data.recentDocuments}
        emptyMessage="No catalogue documents have been stored yet."
      />
    </div>
  );
}
