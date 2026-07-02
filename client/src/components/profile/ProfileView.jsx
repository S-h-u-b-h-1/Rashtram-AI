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

export function ProfileView() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-5">
      <ProfileIdentity user={profile.user} />
      <ResearchActivity
        stats={{
          ...profile.userActivityStats,
          ...(profile.account?.analytics || {}),
        }}
      />
      <ContinueResearch chats={profile.recentChats} />
      <ComparisonHistory />
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
      <ProfileSupportForms defaultEmail={profile.user.email} />
    </div>
  );
}
