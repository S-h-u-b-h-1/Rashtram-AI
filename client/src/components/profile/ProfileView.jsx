"use client";

import { useEffect, useState } from "react";
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
import { ProfileAccountSnapshot } from "./ProfileAccountSnapshot";

export function ProfileView() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsPanel, setSettingsPanel] = useState("details");

  const openSettings = (panel) => {
    setSettingsPanel(panel);
    requestAnimationFrame(() => {
      document.getElementById("account-settings")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadProfile = async () => {
      try {
        const profileData = await api.getProfile();
        if (!controller.signal.aborted) {
          setProfile(profileData);
          api.trackActivity({
            event_type: "profile_viewed",
            entity_type: "profile",
            page_path: "/app/profile",
          });
        }
      } catch (requestError) {
        console.error("Failed to load research profile:", requestError);
        if (!controller.signal.aborted) {
          setError("Your profile data could not be loaded right now.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadProfile();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div
        className="space-y-5 pb-2"
        aria-label="Loading profile"
        aria-busy="true"
      >
        <div className="h-52 animate-pulse rounded-[1.8rem] bg-[#8f1d2c]/90 sm:h-56" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl bg-white/65"
            />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
          <div className="h-80 animate-pulse rounded-[1.4rem] bg-white/65" />
          <div className="h-80 animate-pulse rounded-[1.4rem] bg-white/65" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="surface-card grid min-h-[360px] place-items-center p-8 text-center">
        <div>
          <p className="font-serif text-2xl text-[#8f1d2c]">
            Your research profile is temporarily unavailable.
          </p>
          <p className="mt-2 text-sm text-[#85434a]">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-10 rounded-xl bg-[#8f1d2c] px-4 text-xs font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 pb-2">
      <ProfileIdentity
        user={profile.user}
        profile={profile.account?.profile}
        onEdit={() => openSettings("details")}
      />
      <div id="research-activity" className="scroll-mt-6">
        <ResearchActivity
          stats={{
            ...profile.userActivityStats,
            ...(profile.account?.analytics || {}),
          }}
        />
      </div>

      <div
        id="recent-research"
        className="grid min-w-0 scroll-mt-6 items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]"
      >
        <div className="min-w-0 space-y-5">
          <ContinueResearch chats={profile.recentChats} />
          <ComparisonHistory />
        </div>
        <ProfileAccountSnapshot
          account={profile.account}
          user={profile.user}
          onOpen={openSettings}
        />
      </div>

      <AccountSettings
        account={profile.account}
        user={profile.user}
        activePanel={settingsPanel}
        onPanelChange={setSettingsPanel}
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

      <RecommendationHistory />
      <GraphResearchJourneys insights={profile.graphInsights} />

      <div id="privacy-settings" className="scroll-mt-6">
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
