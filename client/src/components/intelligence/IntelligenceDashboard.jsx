"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { ContinueResearch } from "./ContinueResearch";
import { DashboardHero } from "./DashboardHero";
import { DocumentListSection } from "./DocumentListSection";
import { IntelligenceFeed } from "./IntelligenceFeed";
import { SourceHealthPanel } from "./SourceHealthPanel";

function DemoHighlights({ documents = [] }) {
  if (!documents.length) return null;
  return (
    <section className="surface-card border-[#c1a06f]/25 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
            Internal demo mode
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
            Strong real examples
          </h2>
          <p className="mt-2 text-xs leading-5 text-[#777066]">
            These are source-backed catalogue records selected for a concise
            product walkthrough. No sample records are inserted.
          </p>
        </div>
        <Sparkles className="h-5 w-5 text-[#9d7240]" />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {documents.slice(0, 4).map((document) => (
          <Link
            key={document.id}
            href={`/app/document/${document.id}`}
            className="group rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4"
          >
            <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#29312d]">
              {document.title}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#8f1d2c]">
              Open research workspace
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Trends({ categories = [] }) {
  if (categories.length < 3) return null;
  return (
    <section className="surface-card p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
        Catalogue signal
      </p>
      <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
        Topics with sufficient coverage
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.slice(0, 8).map((category) => (
          <span
            key={category.label}
            className="rounded-full border border-[#8f1d2c]/9 bg-[#f6f2eb] px-3 py-2 text-xs text-[#514d46]"
          >
            {category.label} · {category.documentCount}
          </span>
        ))}
      </div>
    </section>
  );
}

export function IntelligenceDashboard({ onNavigate, demoMode = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .getDashboardIntelligence()
      .then((intelligence) => {
        if (!active) return;
        setData(intelligence);
        api.trackActivity({
          event_type: "dashboard_viewed",
          entity_type: "dashboard",
          page_path: "/app",
        });
      })
      .catch(() => {
        if (active) {
          setError("The intelligence desk could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
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

      {demoMode && <DemoHighlights documents={data.demoHighlights} />}

      <ContinueResearch chats={data.recentUserChats || []} />

      <IntelligenceFeed
        events={data.intelligenceEvents || []}
        isFallback={data.emptyStateFlags?.noLiveEvents}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <DocumentListSection
          eyebrow="Verified policy coverage"
          title="What should I read?"
          documents={(data.recommendedReading || []).length
            ? data.recommendedReading
            : data.latestPolicies || []}
          emptyMessage="No sufficiently supported policy recommendation is available yet."
          onViewAll={() => onNavigate("policies")}
        />
        <DocumentListSection
          eyebrow="State legislatures"
          title="Recent State Bills"
          documents={data.latestStateBills || []}
          emptyMessage="No recent state-level records are currently stored."
          onViewAll={() => onNavigate("state-bills")}
        />
      </div>

      <Trends categories={data.trendingCategories || []} />
      <SourceHealthPanel sources={data.sourceHealth || []} compact />
    </div>
  );
}
