"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import { ContinueResearch } from "@/components/intelligence/ContinueResearch";
import { AccountSettings } from "./AccountSettings";
import { ProfileIdentity } from "./ProfileIdentity";
import { ProfileSupportForms } from "./ProfileSupportForms";
import { ResearchActivity } from "./ResearchActivity";
import { DataPersonalization } from "./DataPersonalization";
import { ComparisonHistory } from "./ComparisonHistory";
import { RecommendationHistory } from "./RecommendationHistory";
import { GraphResearchJourneys } from "./GraphResearchJourneys";
import { useAuth } from "@/context/AuthContext";
import { RefreshCw } from "lucide-react";

const profileSections = [
  ["research-activity", "Overview"],
  ["recent-research", "Recent research"],
  ["account-settings", "Account settings"],
  ["privacy-settings", "Privacy"],
];

export function ProfileView() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const profileData = await api.getProfile();
      if (!signal?.aborted) {
        setProfile(profileData);
        api.trackActivity({
          event_type: "profile_viewed",
          entity_type: "profile",
          page_path: "/app/profile",
        });
      }
    } catch (requestError) {
      console.error("Failed to load research profile:", requestError);
      if (!signal?.aborted) {
        setError("Your profile data could not be loaded right now.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadProfile(controller.signal);
    return () => controller.abort();
  }, [loadProfile]);

  if (loading) {
    return (
      <div className="space-y-5" aria-label="Loading profile">
        <div className="h-56 animate-pulse rounded-[1.8rem] bg-[#8f1d2c]/90" />
        <div className="h-64 animate-pulse rounded-[1.4rem] bg-white/55" />
        <div className="h-80 animate-pulse rounded-[1.4rem] bg-white/55" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="surface-card grid min-h-[420px] place-items-center p-8 text-center">
        <div>
          <p className="font-serif text-2xl text-[#8f1d2c]">
            Your research profile is temporarily unavailable.
          </p>
          <p className="mt-2 text-sm text-[#85434a]">{error}</p>
          <button
            type="button"
            onClick={() => loadProfile()}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#8f1d2c] px-4 py-2.5 text-xs font-semibold text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-5">
      <ProfileIdentity
        user={profile.user}
        role={profile.account?.profile?.role}
        onSignOut={logout}
      />
      <nav
        aria-label="Profile sections"
        className="surface-card app-scrollbar flex gap-2 overflow-x-auto p-2"
      >
        {profileSections.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-[#706a61] transition hover:bg-[#eee0dc] hover:text-[#8f1d2c]"
          >
            {label}
          </a>
        ))}
      </nav>
      <ResearchActivity
        stats={{
          ...profile.userActivityStats,
          ...(profile.account?.analytics || {}),
        }}
      />
      <section id="recent-research" className="scroll-mt-24 space-y-5">
        <ContinueResearch chats={profile.recentChats} />
        <div className="grid gap-5 xl:grid-cols-2">
          <ComparisonHistory />
          <RecommendationHistory />
        </div>
        <GraphResearchJourneys insights={profile.graphInsights} />
      </section>
      <div id="account-settings" className="scroll-mt-24">
        <AccountSettings
          account={profile.account}
          onUpdate={(updates) =>
            setProfile((current) => ({
              ...current,
              account: {
                ...current.account,
                ...updates,
              },
              user: updates.profile
                ? {
                    ...current.user,
                    name: updates.profile.name,
                    avatar: updates.profile.avatar,
                    initials: updates.profile.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase(),
                  }
                : current.user,
            }))
          }
        />
      </div>
      <div id="privacy-settings" className="scroll-mt-24">
        <DataPersonalization
          insights={profile.activityInsights}
          onUpdate={(preferences) =>
            setProfile((current) => ({
              ...current,
              activityInsights: {
                ...current.activityInsights,
                ...preferences,
              },
            }))
          }
        />
      </div>
      <ProfileSupportForms defaultEmail={profile.user.email} />
    </div>
  );
}
