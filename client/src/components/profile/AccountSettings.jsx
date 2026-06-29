"use client";

import {
  Bookmark,
  Download,
  FolderPlus,
  KeyRound,
  Laptop,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import * as api from "@/lib/api";
import { formatDate, humanize } from "@/lib/document-links";

const join = (items) => (Array.isArray(items) ? items.join(", ") : "");
const split = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function AccountSettings({ account, onUpdate }) {
  const initial = account?.profile || {};
  const [form, setForm] = useState({
    ...initial,
    researchInterests: join(initial.researchInterests),
    preferredMinistries: join(initial.preferredMinistries),
    preferredPolicyAreas: join(initial.preferredPolicyAreas),
    preferredJurisdictions: join(initial.preferredJurisdictions),
    preferredDocumentTypes: join(initial.preferredDocumentTypes),
    preferredSources: join(initial.preferredSources),
  });
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [collectionName, setCollectionName] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const savedByType = useMemo(() => {
    const values = { bookmarks: [], pinned: [] };
    for (const item of account?.savedContent || []) {
      if (item.itemType === "bookmark") values.bookmarks.push(item);
      else values.pinned.push(item);
    }
    return values;
  }, [account?.savedContent]);

  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const saveProfile = async () => {
    setSaving(true);
    setNotice("");
    try {
      const response = await api.updateProfile({
        ...form,
        researchInterests: split(form.researchInterests),
        preferredMinistries: split(form.preferredMinistries),
        preferredPolicyAreas: split(form.preferredPolicyAreas),
        preferredJurisdictions: split(form.preferredJurisdictions),
        preferredDocumentTypes: split(form.preferredDocumentTypes),
        preferredSources: split(form.preferredSources),
      });
      onUpdate({ profile: response.profile });
      setNotice("Profile and research preferences saved.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async () => {
    setSaving(true);
    setNotice("");
    try {
      const response = await api.changePassword(
        password.currentPassword,
        password.newPassword,
      );
      setPassword({ currentPassword: "", newPassword: "" });
      setNotice(response.message);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  };

  const createCollection = async () => {
    if (!collectionName.trim()) return;
    const response = await api.createResearchCollection({
      name: collectionName,
    });
    onUpdate({
      collections: [response.collection, ...(account?.collections || [])],
    });
    setCollectionName("");
  };

  const removeSaved = async (id) => {
    await api.removeSavedContent(id);
    onUpdate({
      savedContent: (account.savedContent || []).filter(
        (item) => item.id !== id,
      ),
    });
  };

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[#8f1d2c]/8 bg-[#f7f2eb] p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
          Account center
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
          Profile, preferences & saved research
        </h2>
        <p className="mt-2 text-sm text-[#777066]">
          Manage how Rashtram AI represents your work and personalizes your
          research environment.
        </p>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
        <div>
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-[#874047]" />
            <h3 className="text-sm font-semibold text-[#29312d]">
              Public and professional details
            </h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["name", "Name"],
              ["username", "Username"],
              ["organization", "Organization"],
              ["designation", "Designation"],
              ["location", "Location"],
              ["phone", "Phone"],
              ["timezone", "Timezone"],
              ["avatar", "Profile photo URL"],
            ].map(([key, label]) => (
              <label key={key} className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#81796e]">
                  {label}
                </span>
                <input
                  value={form[key] || ""}
                  onChange={(event) => change(key, event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-sm outline-none focus:border-[#a85a52]"
                />
              </label>
            ))}
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#81796e]">
                Bio
              </span>
              <textarea
                value={form.bio || ""}
                onChange={(event) => change("bio", event.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-[#8f1d2c]/10 bg-white p-3 text-sm outline-none focus:border-[#a85a52]"
              />
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#29312d]">
            Research preferences
          </h3>
          <p className="mt-1 text-xs text-[#81796e]">
            Enter comma-separated values. These guide recommendations without
            changing the underlying evidence.
          </p>
          <div className="mt-4 grid gap-3">
            {[
              ["researchInterests", "Research interests"],
              ["preferredMinistries", "Preferred ministries"],
              ["preferredPolicyAreas", "Preferred policy areas"],
              ["preferredJurisdictions", "Preferred jurisdictions / states"],
              ["preferredDocumentTypes", "Preferred document types"],
              ["preferredSources", "Preferred sources"],
            ].map(([key, label]) => (
              <label key={key} className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#81796e]">
                  {label}
                </span>
                <input
                  value={form[key] || ""}
                  onChange={(event) => change(key, event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-sm outline-none focus:border-[#a85a52]"
                />
              </label>
            ))}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [
                  "languagePreference",
                  "Language",
                  ["English", "Hindi"],
                ],
                [
                  "themePreference",
                  "Theme",
                  ["system", "light", "dark"],
                ],
                [
                  "researchVisibility",
                  "Visibility",
                  ["private", "organization"],
                ],
              ].map(([key, label, values]) => (
                <label key={key} className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#81796e]">
                    {label}
                  </span>
                  <select
                    value={form[key] || values[0]}
                    onChange={(event) => change(key, event.target.value)}
                    className="h-11 w-full rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-sm"
                  >
                    {values.map((value) => (
                      <option key={value} value={value}>
                        {humanize(value)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#8f1d2c]/8 bg-[#f7f2eb] px-5 py-4 sm:px-6">
        <p className="text-xs text-[#706a61]">{notice}</p>
        <button
          type="button"
          disabled={saving}
          onClick={saveProfile}
          className="inline-flex items-center gap-2 rounded-full bg-[#8f1d2c] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          Save profile
        </button>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-[#874047]" />
            <h3 className="text-sm font-semibold text-[#29312d]">
              Saved content
            </h3>
          </div>
          <div className="mt-3 space-y-2">
            {[...savedByType.bookmarks, ...savedByType.pinned]
              .slice(0, 8)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-semibold text-[#29312d]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[9px] uppercase text-[#8a8277]">
                      {humanize(item.itemType)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSaved(item.id)}
                    aria-label={`Remove ${item.title}`}
                    className="text-[#914148]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            {!account?.savedContent?.length && (
              <p className="text-xs leading-5 text-[#81796e]">
                Bookmark documents from the unified research workspace.
              </p>
            )}
          </div>
          {(account?.savedSearches || []).length > 0 && (
            <div className="mt-4 border-t border-[#8f1d2c]/8 pt-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8a8277]">
                Saved searches
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {account.savedSearches.slice(0, 6).map((search) => (
                  <span
                    key={search.id}
                    className="rounded-full bg-[#eee0dc] px-3 py-2 text-[10px] text-[#874047]"
                  >
                    {search.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-[#874047]" />
            <h3 className="text-sm font-semibold text-[#29312d]">
              Research collections
            </h3>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              placeholder="New collection"
              className="h-10 min-w-0 flex-1 rounded-xl border border-[#8f1d2c]/10 px-3 text-xs"
            />
            <button
              type="button"
              onClick={createCollection}
              className="rounded-xl bg-[#8f1d2c] px-3 text-xs font-semibold text-white"
            >
              Create
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {(account?.collections || []).slice(0, 6).map((collection) => (
              <article
                key={collection.id}
                className="rounded-xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-3"
              >
                <p className="text-xs font-semibold text-[#29312d]">
                  {collection.name}
                </p>
                <p className="mt-1 text-[10px] text-[#81796e]">
                  {collection.items?.length || 0} documents
                </p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4 text-[#874047]" />
            <h3 className="text-sm font-semibold text-[#29312d]">
              Active sessions
            </h3>
          </div>
          <div className="mt-3 space-y-2">
            {(account?.sessions || []).slice(0, 4).map((session) => (
              <article
                key={session.id}
                className="flex items-start gap-3 rounded-xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-semibold text-[#29312d]">
                    {session.userAgent || "Browser session"}
                  </p>
                  <p className="mt-1 text-[10px] text-[#81796e]">
                    Last active {formatDate(session.lastSeenAt)}
                  </p>
                </div>
                {!session.revokedAt && (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.revokeSession(session.id);
                      onUpdate({
                        sessions: (account.sessions || []).map((item) =>
                          item.id === session.id
                            ? {
                                ...item,
                                revokedAt: new Date().toISOString(),
                              }
                            : item,
                        ),
                      });
                    }}
                    className="text-[9px] font-semibold text-[#914148]"
                  >
                    Revoke
                  </button>
                )}
              </article>
            ))}
            {!account?.sessions?.length && (
              <p className="text-xs leading-5 text-[#81796e]">
                New session-aware logins will appear here.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 border-t border-[#8f1d2c]/8 bg-[#f7f2eb] p-5 sm:p-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#874047]" />
            <h3 className="text-sm font-semibold text-[#29312d]">
              Change password
            </h3>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={password.currentPassword}
              onChange={(event) =>
                setPassword((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
              placeholder="Current password"
              className="h-10 min-w-0 flex-1 rounded-xl border border-[#8f1d2c]/10 px-3 text-xs"
            />
            <input
              type="password"
              value={password.newPassword}
              onChange={(event) =>
                setPassword((current) => ({
                  ...current,
                  newPassword: event.target.value,
                }))
              }
              placeholder="New password"
              className="h-10 min-w-0 flex-1 rounded-xl border border-[#8f1d2c]/10 px-3 text-xs"
            />
            <button
              type="button"
              disabled={saving || password.newPassword.length < 8}
              onClick={updatePassword}
              className="rounded-xl border border-[#8f1d2c]/12 px-3 text-xs font-semibold text-[#874047] disabled:opacity-40"
            >
              Update
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={api.exportProfileData}
          className="flex items-center justify-center gap-2 rounded-2xl border border-[#8f1d2c]/10 bg-white p-4 text-sm font-semibold text-[#874047]"
        >
          <Download className="h-4 w-4" />
          Export profile and research history
        </button>
      </div>
    </section>
  );
}
