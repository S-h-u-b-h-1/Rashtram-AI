"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { ContinueResearch } from "./ContinueResearch";
import { DashboardHero } from "./DashboardHero";
import { DocumentListSection } from "./DocumentListSection";
import { IntelligenceFeed } from "./IntelligenceFeed";
import { IntelligenceSidebar } from "./IntelligenceSidebar";
import { SourceHealthPanel } from "./SourceHealthPanel";

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
        <div className="h-80 animate-pulse rounded-[1.8rem] bg-[#c30000]/90" />
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
          <p className="font-serif text-2xl text-[#c30000]">
            The intelligence desk is temporarily unavailable.
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#8c4436]">
            {error}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate("bills")}
              className="rounded-full bg-[#c30000] px-4 py-2.5 text-xs font-semibold text-white"
            >
              Open Bills
            </button>
            <button
              type="button"
              onClick={() => onNavigate("acts")}
              className="rounded-full border border-[#c30000]/12 px-4 py-2.5 text-xs font-semibold text-[#c30000]"
            >
              Open Acts
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-5">
      <DashboardHero data={data} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,0.75fr)]">
        <IntelligenceFeed
          events={data.intelligenceEvents}
          isFallback={data.emptyStateFlags.noLiveEvents}
        />
        <IntelligenceSidebar
          trendingCategories={data.trendingCategories}
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
