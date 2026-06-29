"use client";

import {
  DatabaseZap,
  Download,
  Eye,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import * as api from "@/lib/api";
import { humanize } from "@/lib/document-links";

function PrivacySwitch({ checked, disabled, label, description, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4">
      <div>
        <p className="text-sm font-semibold text-[#29312d]">{label}</p>
        <p className="mt-1 max-w-xl text-xs leading-5 text-[#81796e]">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-[#34725b]" : "bg-[#c9c2b7]"
        } disabled:cursor-not-allowed disabled:opacity-45`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

export function DataPersonalization({ insights, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const savePreferences = async (next) => {
    setSaving(true);
    setError("");
    try {
      const preferences = await api.updateActivityPreferences(next);
      onUpdate(preferences);
    } catch {
      setError("Privacy preferences could not be updated right now.");
    } finally {
      setSaving(false);
    }
  };

  const safeInsights = {
    activityTrackingEnabled: false,
    personalizationEnabled: false,
    recentDocuments: [],
    topTopics: [],
    topJurisdictions: [],
    mostViewedDocumentTypes: [],
    recentSearches: [],
    ...(insights || {}),
  };
  const activityEnabled = Boolean(safeInsights.activityTrackingEnabled);
  const personalizationEnabled = Boolean(
    safeInsights.personalizationEnabled,
  );
  const hasInsights =
    safeInsights.recentDocuments.length ||
    safeInsights.topTopics.length ||
    safeInsights.topJurisdictions.length ||
    safeInsights.mostViewedDocumentTypes.length ||
    safeInsights.recentSearches.length;

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e2ece6] text-[#34725b]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
            Privacy controls
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
            Data & Personalization
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#777066]">
            Optional activity data improves Continue Research and future
            recommendations. It never includes passwords, tokens, document
            contents, or private secrets.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <PrivacySwitch
          checked={activityEnabled}
          disabled={saving}
          label="Research activity history"
          description="Store document opens, searches, filters, and research actions in your account. Disabled by default."
          onChange={(enabled) =>
            savePreferences({
              activityTrackingEnabled: enabled,
              personalizationEnabled: enabled
                ? personalizationEnabled
                : false,
            })
          }
        />
        <PrivacySwitch
          checked={personalizationEnabled}
          disabled={saving || !activityEnabled}
          label="Personalized research suggestions"
          description="Use your opted-in activity to improve topic and document recommendations. No data is sold or exposed."
          onChange={(enabled) =>
            savePreferences({
              activityTrackingEnabled: activityEnabled,
              personalizationEnabled: enabled,
            })
          }
        />
      </div>

      {error && (
        <p className="mt-3 text-xs font-medium text-[#914148]">{error}</p>
      )}

      {!activityEnabled ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#8f1d2c]/12 bg-[#f1ece3]/65 p-6">
          <Eye className="h-5 w-5 text-[#8a8277]" />
          <p className="mt-3 text-sm font-semibold text-[#514d46]">
            Activity collection is off
          </p>
          <p className="mt-1 text-xs leading-5 text-[#81796e]">
            Dashboard and research activity is not stored until you choose to
            enable it.
          </p>
        </div>
      ) : hasInsights ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#874047]">
              Research signals
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...safeInsights.topTopics, ...safeInsights.topJurisdictions]
                .slice(0, 10)
                .map((item) => (
                  <span
                    key={`${item.label}-${item.interactions}`}
                    className="rounded-full bg-[#f1eadf] px-3 py-2 text-xs text-[#514d46]"
                  >
                    {item.label} · {item.interactions}
                  </span>
                ))}
              {safeInsights.mostViewedDocumentTypes.map((item) => (
                <span
                  key={item.label}
                  className="rounded-full bg-[#e2ece6] px-3 py-2 text-xs text-[#315a49]"
                >
                  {humanize(item.label)} · {item.interactions}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#874047]">
              Recent opted-in activity
            </p>
            <div className="mt-3 space-y-2 text-xs text-[#6f685f]">
              {safeInsights.recentDocuments.slice(0, 3).map((document) => (
                <p key={document.documentId} className="line-clamp-1">
                  {document.title}
                </p>
              ))}
              {safeInsights.recentSearches.slice(0, 3).map((search) => (
                <p key={`${search.query}-${search.searchedAt}`}>
                  Search: “{search.query}”
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-[#f1ece3] p-5 text-sm text-[#706a61]">
          Insights will appear after you use search, filters, documents, and
          research workspaces.
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled
          className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4 text-left opacity-70"
        >
          <Download className="h-4 w-4 text-[#874047]" />
          <span className="text-sm font-semibold text-[#29312d]">
            Export activity data — coming soon
          </span>
        </button>
        <button
          type="button"
          disabled
          className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-[#a33d31]/12 bg-[#f6f2eb] p-4 text-left opacity-70"
        >
          <Trash2 className="h-4 w-4 text-[#a33d31]" />
          <span className="text-sm font-semibold text-[#29312d]">
            Delete activity data — coming soon
          </span>
        </button>
      </div>

      <div className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-[#81796e]">
        <DatabaseZap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Activity data stays in Rashtram AI&apos;s PostgreSQL account records and
        is not used to claim legal authority.
      </div>
    </section>
  );
}
