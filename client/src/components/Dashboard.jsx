"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  FileText,
  MessageSquareText,
  Scale,
  Sparkles,
} from "lucide-react";
import * as api from "@/lib/api";

const statIcons = [MessageSquareText, FileText, Scale];

function ResearchList({ title, eyebrow, items, type, onViewAll }) {
  const isBill = type === "bill";
  const EmptyIcon = isBill ? FileText : Scale;

  return (
    <section className="surface-card flex min-h-[350px] flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9e4937]">
            {eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#c30000]">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 rounded-full border border-[#c30000]/10 px-3 py-2 text-xs font-semibold text-[#5f5a52] transition hover:bg-[#c30000] hover:text-white"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-6 flex-1 space-y-2">
        {items.length === 0 ? (
          <div className="grid h-full min-h-52 place-items-center rounded-2xl border border-dashed border-[#c30000]/12 bg-[#f7f2e8]/65 text-center">
            <div>
              <EmptyIcon className="mx-auto h-7 w-7 text-[#9b9387]" />
              <p className="mt-3 text-sm font-medium text-[#514d46]">
                No recent {isBill ? "bill" : "act"} research
              </p>
              <p className="mt-1 text-xs text-[#8a8277]">
                Open a document to begin a conversation.
              </p>
            </div>
          </div>
        ) : (
          items.slice(0, 5).map((item) => {
            const titleText = isBill ? item.billTitle : item.actTitle;
            const status = isBill
              ? item.billStatus || "Unknown status"
              : item.actStatus || "Active";
            const updatedAt = isBill ? item.lastMessageAt : item.updatedAt;

            return (
              <div
                key={item._id || `${type}-${titleText}-${updatedAt}`}
                className="group flex items-center gap-4 rounded-xl border border-transparent p-3 transition hover:border-[#c30000]/8 hover:bg-[#f5efe5]"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ebe3d6] text-[#9f4937]">
                  <BookOpenText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#29312d]">
                    {titleText}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-[#857e73]">
                    {status} · {new Date(updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#aaa195] transition group-hover:translate-x-0.5 group-hover:text-[#9f4937]" />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState({
    recentBills: [],
    recentActs: [],
    stats: { totalBills: 0, totalActs: 0, totalChats: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const dashboardData = await api.getDashboardData();
        if (!active) return;
        setData(dashboardData);
        setLastUpdated(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } catch (requestError) {
        console.error("Failed to fetch dashboard data:", requestError);
        if (active) setError("We could not load your research overview.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid h-full min-h-[420px] place-items-center">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#c30000]/12 border-t-[#ad4a36]" />
          <p className="mt-4 text-sm text-[#706a61]">
            Preparing your research desk…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface-card grid min-h-[360px] place-items-center p-8 text-center">
        <div>
          <p className="font-serif text-2xl text-[#c30000]">
            Your desk is temporarily unavailable.
          </p>
          <p className="mt-2 text-sm text-[#8c4436]">{error}</p>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Research conversations", value: data.stats.totalChats },
    { label: "Bills analysed", value: data.stats.totalBills },
    { label: "Acts researched", value: data.stats.totalActs },
  ];

  return (
    <div className="space-y-6 pb-4">
      <section className="relative overflow-hidden rounded-[1.8rem] bg-[#c30000] p-7 text-white sm:p-9">
        <div className="policy-grid absolute inset-0 opacity-20" />
        <div className="absolute -right-14 -top-16 h-56 w-56 rounded-full bg-[#d97745]/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/65">
              <Sparkles className="h-3.5 w-3.5 text-[#efb36f]" />
              Evidence workspace ready
            </div>
            <h1 className="mt-5 max-w-2xl font-serif text-4xl leading-tight tracking-[-0.035em] sm:text-5xl">
              What policy question are you following today?
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/52">
              Choose a bill or act, inspect its evidence brief, and continue the
              conversation where you left off.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate("Parliament Bills")}
              className="rounded-full bg-[#fffaf0] px-5 py-3 text-sm font-semibold text-[#c30000] transition hover:-translate-y-0.5"
            >
              Explore bills
            </button>
            <button
              type="button"
              onClick={() => onNavigate("Parliament Acts")}
              className="rounded-full border border-white/14 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Browse acts
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, index) => {
          const Icon = statIcons[index];
          return (
            <article
              key={stat.label}
              className="surface-card flex items-center gap-4 p-5 sm:p-6"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eee5d7] text-[#9f4937]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-serif text-3xl leading-none text-[#c30000]">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs text-[#797268]">{stat.label}</p>
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <ResearchList
          title="Recent bill conversations"
          eyebrow="Bills"
          items={data.recentBills}
          type="bill"
          onViewAll={() => onNavigate("Parliament Bills")}
        />
        <ResearchList
          title="Recent act conversations"
          eyebrow="Acts"
          items={data.recentActs}
          type="act"
          onViewAll={() => onNavigate("Parliament Acts")}
        />
      </div>

      {lastUpdated && (
        <p className="text-right text-[10px] uppercase tracking-[0.16em] text-[#9a9286]">
          Updated {lastUpdated}
        </p>
      )}
    </div>
  );
}
