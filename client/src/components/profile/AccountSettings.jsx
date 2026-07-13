"use client";

import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  Download,
  FolderPlus,
  GitCompareArrows,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as api from "@/lib/api";
import { formatDate, humanize } from "@/lib/document-links";
import { useComparison } from "@/context/ComparisonContext";
import { useAuth } from "@/context/AuthContext";

const join = (items) => (Array.isArray(items) ? items.join(", ") : "");
const split = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const inputClass =
  "h-11 w-full rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-sm text-[#352f2b] outline-none transition placeholder:text-[#aaa196] focus:border-[#a85a52] focus:ring-4 focus:ring-[#a85a52]/10";
const labelClass =
  "text-[10px] font-semibold uppercase tracking-[0.11em] text-[#776f65]";

const PANELS = [
  { id: "details", label: "Account details", icon: UserRound },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "research", label: "Saved research", icon: Bookmark },
  { id: "security", label: "Security", icon: ShieldCheck },
];

function Field({ label, hint, wide = false, children }) {
  return (
    <label className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="block text-[10px] leading-4 text-[#91887d]">{hint}</span>}
    </label>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#874047]">
        {eyebrow}
      </p>
      <h3 className="mt-1.5 font-serif text-xl text-[#8f1d2c]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-2xl text-xs leading-5 text-[#81796e]">
          {description}
        </p>
      )}
    </div>
  );
}

export function AccountSettings({
  account,
  user,
  onUpdate,
  activePanel,
  onPanelChange,
}) {
  const { addDocument, removeDocument, isSelected } = useComparison();
  const { deleteAccount, logout } = useAuth();
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
  const [notice, setNotice] = useState({ type: "", message: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    confirmation: "",
    password: "",
  });
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState("");

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

  const resetForm = () => {
    setForm({
      ...initial,
      researchInterests: join(initial.researchInterests),
      preferredMinistries: join(initial.preferredMinistries),
      preferredPolicyAreas: join(initial.preferredPolicyAreas),
      preferredJurisdictions: join(initial.preferredJurisdictions),
      preferredDocumentTypes: join(initial.preferredDocumentTypes),
      preferredSources: join(initial.preferredSources),
    });
    setNotice({ type: "neutral", message: "Unsaved changes discarded." });
  };

  const saveProfile = async () => {
    setSaving(true);
    setNotice({ type: "", message: "" });
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
      setNotice({ type: "success", message: "Your account details have been saved." });
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Profile update failed." });
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async () => {
    setSaving(true);
    setNotice({ type: "", message: "" });
    try {
      const response = await api.changePassword(
        password.currentPassword,
        password.newPassword,
      );
      setPassword({ currentPassword: "", newPassword: "" });
      setNotice({ type: "success", message: response.message });
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Password update failed." });
    } finally {
      setSaving(false);
    }
  };

  const createCollection = async () => {
    if (!collectionName.trim()) return;
    setNotice({ type: "", message: "" });
    try {
      const response = await api.createResearchCollection({ name: collectionName });
      onUpdate({ collections: [response.collection, ...(account?.collections || [])] });
      setCollectionName("");
      setNotice({ type: "success", message: "Research collection created." });
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Collection could not be created." });
    }
  };

  const removeSaved = async (id) => {
    try {
      await api.removeSavedContent(id);
      onUpdate({
        savedContent: (account.savedContent || []).filter((item) => item.id !== id),
      });
      setNotice({ type: "success", message: "Saved item removed." });
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Saved item could not be removed." });
    }
  };

  const revokeSession = async (sessionId) => {
    try {
      await api.revokeSession(sessionId);
      onUpdate({
        sessions: (account.sessions || []).map((session) =>
          session.id === sessionId
            ? { ...session, revokedAt: new Date().toISOString() }
            : session,
        ),
      });
      setNotice({ type: "success", message: "Session revoked." });
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Session could not be revoked." });
    }
  };

  const canDelete =
    deleteForm.confirmation === "DELETE" &&
    (!initial.hasPassword || deleteForm.password.length > 0);

  const submitDeleteAccount = async () => {
    if (!canDelete || deletingAccount) return;
    setDeletingAccount(true);
    setDeleteNotice("");
    try {
      await deleteAccount(deleteForm);
    } catch (error) {
      setDeleteNotice(error.message || "Account deletion failed.");
      setDeletingAccount(false);
    }
  };

  return (
    <Dialog.Root
      open={deleteOpen}
      onOpenChange={(open) => {
        if (!deletingAccount) setDeleteOpen(open);
      }}
    >
    <section id="account-settings" className="surface-card scroll-mt-6 overflow-hidden">
      <div className="border-b border-[#8f1d2c]/8 px-5 py-5 sm:px-6 lg:flex lg:items-end lg:justify-between lg:gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
            Account center
          </p>
          <h2 className="mt-1.5 font-serif text-2xl text-[#8f1d2c]">
            Manage your Rashtram AI account
          </h2>
          <p className="mt-1 text-sm text-[#777066]">
            Profile details, research preferences, saved work, and security—organized in one place.
          </p>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#e8f0eb] px-3 py-2 text-[10px] font-semibold text-[#34725b] lg:mt-0">
          <ShieldCheck className="h-3.5 w-3.5" />
          {user.authenticationProvider} sign-in connected
        </div>
      </div>

      <div className="grid gap-2 border-b border-[#8f1d2c]/8 bg-[#f4efe7] p-3 sm:grid-cols-2 lg:grid-cols-4">
        {PANELS.map((panel) => {
          const PanelIcon = panel.icon;
          const selected = activePanel === panel.id;
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => {
                onPanelChange(panel.id);
                setNotice({ type: "", message: "" });
              }}
              aria-pressed={selected}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition ${
                selected
                  ? "bg-[#8f1d2c] text-white shadow-sm"
                  : "bg-white/65 text-[#71695f] hover:bg-white hover:text-[#8f1d2c]"
              }`}
            >
              <PanelIcon className="h-3.5 w-3.5" />
              {panel.label}
            </button>
          );
        })}
      </div>

      {notice.message && (
        <div
          role="status"
          className={`mx-5 mt-5 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs sm:mx-6 ${
            notice.type === "success"
              ? "border-[#34725b]/15 bg-[#e8f0eb] text-[#315a49]"
              : notice.type === "error"
                ? "border-[#914148]/15 bg-[#fff2ef] text-[#914148]"
                : "border-[#8f1d2c]/8 bg-[#f6f2eb] text-[#706a61]"
          }`}
        >
          {notice.type === "success" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {notice.message}
        </div>
      )}

      {activePanel === "details" && (
        <div className="p-5 sm:p-6">
          <SectionHeading
            eyebrow="Personal information"
            title="Account details"
            description="Update the information used across your research workspace. Your email remains read-only until a verified email-change flow is available."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input value={form.name || ""} onChange={(event) => change("name", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Account email" hint="Email changes require a verified security flow.">
              <input value={form.email || ""} readOnly aria-readonly="true" className={`${inputClass} bg-[#eee8de] text-[#706a61]`} />
            </Field>
            {[
              ["username", "Username"],
              ["organization", "Organization"],
              ["role", "Role / account function"],
              ["designation", "Designation"],
              ["location", "Location"],
              ["phone", "Phone"],
              ["timezone", "Timezone"],
              ["avatar", "Profile photo URL"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input value={form[key] || ""} onChange={(event) => change(key, event.target.value)} className={inputClass} />
              </Field>
            ))}
            <Field label="Professional bio" wide>
              <textarea value={form.bio || ""} onChange={(event) => change("bio", event.target.value)} rows={4} className={`${inputClass} h-auto resize-y py-3 leading-6`} />
            </Field>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-[#8f1d2c]/8 pt-5">
            <button type="button" disabled={saving} onClick={resetForm} className="h-10 rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-xs font-semibold text-[#8f1d2c] disabled:opacity-50">
              Discard changes
            </button>
            <button type="button" disabled={saving} onClick={saveProfile} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#8f1d2c] px-4 text-xs font-semibold text-white shadow-sm disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save details"}
            </button>
          </div>
        </div>
      )}

      {activePanel === "preferences" && (
        <div className="p-5 sm:p-6">
          <SectionHeading
            eyebrow="Research experience"
            title="Preferences"
            description="These optional signals guide recommendations and workspace defaults; they never alter source evidence."
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {[
              ["researchInterests", "Research interests"],
              ["preferredMinistries", "Preferred ministries"],
              ["preferredPolicyAreas", "Policy areas"],
              ["preferredJurisdictions", "Jurisdictions / states"],
              ["preferredDocumentTypes", "Document types"],
              ["preferredSources", "Preferred sources"],
            ].map(([key, label]) => (
              <Field key={key} label={label} hint="Separate multiple values with commas.">
                <input value={form[key] || ""} onChange={(event) => change(key, event.target.value)} className={inputClass} />
              </Field>
            ))}
          </div>
          <div className="mt-5 grid gap-4 rounded-2xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-4 sm:grid-cols-3">
            {[
              ["languagePreference", "Language", ["English", "Hindi"]],
              ["themePreference", "Theme", ["system", "light", "dark"]],
              ["researchVisibility", "Workspace visibility", ["private", "organization"]],
            ].map(([key, label, values]) => (
              <Field key={key} label={label}>
                <select value={form[key] || values[0]} onChange={(event) => change(key, event.target.value)} className={inputClass}>
                  {values.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
                </select>
              </Field>
            ))}
          </div>
          <fieldset className="mt-4 rounded-2xl border border-[#8f1d2c]/8 bg-white p-4">
            <legend className={`px-1 ${labelClass}`}>Notifications</legend>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
              {[
                ["researchUpdates", "Research updates"],
                ["productUpdates", "Product updates"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-[#514d46]">
                  <input type="checkbox" checked={Boolean(form.notificationPreferences?.[key])} onChange={(event) => change("notificationPreferences", { ...(form.notificationPreferences || {}), [key]: event.target.checked })} className="accent-[#8f1d2c]" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[#8f1d2c]/8 pt-5">
            <button type="button" disabled={saving} onClick={resetForm} className="h-10 rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-xs font-semibold text-[#8f1d2c] disabled:opacity-50">Discard changes</button>
            <button type="button" disabled={saving} onClick={saveProfile} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#8f1d2c] px-4 text-xs font-semibold text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </div>
      )}

      {activePanel === "research" && (
        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Library" title="Saved documents & notes" description="Your latest bookmarks, pinned documents, saved searches, and research notes." />
            <div className="mt-4 space-y-2">
              {[...savedByType.bookmarks, ...savedByType.pinned].slice(0, 8).map((item) => (
                <article key={item.id} className="flex items-start gap-3 rounded-xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-semibold leading-5 text-[#29312d]">{item.title}</p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[#8a8277]">{humanize(item.itemType)}</p>
                  </div>
                  {item.documentId && item.researchReady && (
                    <button type="button" onClick={() => isSelected(item.documentId) ? removeDocument(item.documentId) : addDocument({ id: item.documentId, title: item.title, type: item.documentType, pdfUrl: item.pdfUrl, processingStatus: item.processingStatus, researchReady: item.researchReady })} aria-label={`${isSelected(item.documentId) ? "Remove" : "Add"} ${item.title} ${isSelected(item.documentId) ? "from" : "to"} comparison`} className="grid h-8 w-8 place-items-center rounded-lg text-[#8f1d2c] hover:bg-[#eee0dc]">
                      <GitCompareArrows className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button type="button" onClick={() => removeSaved(item.id)} aria-label={`Remove ${item.title}`} className="grid h-8 w-8 place-items-center rounded-lg text-[#914148] hover:bg-[#f5dfdc]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </article>
              ))}
              {!account?.savedContent?.length && (
                <div className="rounded-2xl border border-dashed border-[#8f1d2c]/12 bg-[#f6f2eb] p-5 text-center text-xs leading-5 text-[#81796e]">
                  Bookmark a research document and it will appear here.
                </div>
              )}
            </div>
            {(account?.notes || []).length > 0 && (
              <div className="mt-5 border-t border-[#8f1d2c]/8 pt-4">
                <p className={labelClass}>Recent notes</p>
                <div className="mt-2 space-y-2">
                  {account.notes.slice(0, 4).map((note) => (
                    <article key={note.id} className="rounded-xl border border-[#8f1d2c]/8 bg-[#fffaf2] p-3">
                      <p className="line-clamp-3 text-xs leading-5 text-[#514d46]">{note.body}</p>
                      <p className="mt-1 text-[9px] text-[#8a8277]">{humanize(note.documentType)} · {formatDate(note.updatedAt)}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <SectionHeading eyebrow="Organization" title="Research collections" description="Group related documents into focused research workspaces." />
            <div className="mt-4 flex gap-2">
              <input value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="Collection name" className={`${inputClass} min-w-0 flex-1`} />
              <button type="button" onClick={createCollection} disabled={!collectionName.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#8f1d2c] px-4 text-xs font-semibold text-white disabled:opacity-45">
                <FolderPlus className="h-3.5 w-3.5" /> Create
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(account?.collections || []).slice(0, 8).map((collection) => (
                <article key={collection.id} className="rounded-xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-3.5">
                  <p className="text-xs font-semibold text-[#29312d]">{collection.name}</p>
                  <p className="mt-1 text-[10px] text-[#81796e]">{collection.items?.length || 0} documents</p>
                </article>
              ))}
              {!account?.collections?.length && (
                <div className="sm:col-span-2 rounded-2xl border border-dashed border-[#8f1d2c]/12 bg-[#f6f2eb] p-5 text-center text-xs text-[#81796e]">
                  No collections yet. Create one to organize a research theme.
                </div>
              )}
            </div>
            {(account?.savedSearches || []).length > 0 && (
              <div className="mt-5 border-t border-[#8f1d2c]/8 pt-4">
                <p className={labelClass}>Saved searches</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {account.savedSearches.slice(0, 8).map((search) => (
                    <span key={search.id} className="rounded-full bg-[#eee0dc] px-3 py-2 text-[10px] text-[#874047]">{search.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activePanel === "security" && (
        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8f0eb] text-[#34725b]"><KeyRound className="h-4 w-4" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-[#29312d]">Sign-in method</h3>
                  <p className="mt-1 text-xs leading-5 text-[#81796e]">Connected with {user.authenticationProvider}. Account email: {user.email}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {initial.hasPassword && (
                  <input type="password" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} placeholder="Current password" className={inputClass} />
                )}
                <input type="password" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} placeholder={initial.hasPassword ? "New password" : "Create a password"} className={inputClass} />
              </div>
              <button type="button" disabled={saving || password.newPassword.length < 8} onClick={updatePassword} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-xs font-semibold text-[#874047] disabled:opacity-40">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {initial.hasPassword ? "Update password" : "Create password"}
              </button>
            </div>

            <div className="rounded-2xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-4 sm:p-5">
              <div className="flex items-center gap-2"><Laptop className="h-4 w-4 text-[#874047]" /><h3 className="text-sm font-semibold text-[#29312d]">Active sessions</h3></div>
              <div className="mt-3 space-y-2">
                {(account?.sessions || []).slice(0, 4).map((session) => (
                  <article key={session.id} className="flex items-start gap-3 rounded-xl border border-[#8f1d2c]/8 bg-white p-3">
                    <div className="min-w-0 flex-1"><p className="line-clamp-1 text-xs font-semibold text-[#29312d]">{session.userAgent || "Browser session"}</p><p className="mt-1 text-[10px] text-[#81796e]">Last active {formatDate(session.lastSeenAt)}</p></div>
                    {!session.revokedAt ? <button type="button" onClick={() => revokeSession(session.id)} className="text-[9px] font-semibold text-[#914148]">Revoke</button> : <span className="text-[9px] text-[#91887d]">Revoked</span>}
                  </article>
                ))}
                {!account?.sessions?.length && <p className="text-xs leading-5 text-[#81796e]">New session-aware logins will appear here.</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={api.exportProfileData} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#8f1d2c]/10 bg-white p-4 text-sm font-semibold text-[#874047] transition hover:border-[#8f1d2c]/20">
              <Download className="h-4 w-4" /> Export profile and research history
            </button>
            <button type="button" onClick={logout} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#8f1d2c]/10 bg-white p-4 text-sm font-semibold text-[#874047] transition hover:border-[#8f1d2c]/20">
              <LogOut className="h-4 w-4" /> Sign out of this browser
            </button>
          </div>

          <div className="rounded-2xl border border-[#914148]/20 bg-[#fff7f4] p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#914148]/10 text-[#914148]"><AlertTriangle className="h-5 w-5" /></div>
              <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#914148]">Danger zone</p><h3 className="mt-1 text-sm font-semibold text-[#29312d]">Delete your account</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-[#706a61]">Permanently removes your profile, sessions, saved work, notes, chats, comparisons, activity, and preferences. Public catalogue data is unaffected.</p></div>
            </div>
            <Dialog.Trigger asChild>
              <button type="button" className="mt-4 inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#914148] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#7d3037] sm:mt-0">
                <Trash2 className="h-3.5 w-3.5" /> Delete account
              </button>
            </Dialog.Trigger>
          </div>
        </div>
      )}
    </section>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-[#18110f]/65 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          onEscapeKeyDown={(event) => {
            if (deletingAccount) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (deletingAccount) event.preventDefault();
          }}
          className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#fffaf4] p-5 shadow-[0_30px_90px_rgba(20,10,12,0.35)] outline-none sm:p-6"
        >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#914148]/10 text-[#914148]"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#914148]">Permanent action</p><h2 id="delete-account-title" className="mt-1 font-serif text-2xl text-[#8f1d2c]">Delete your account?</h2></div></div>
              <Dialog.Close asChild>
                <button type="button" disabled={deletingAccount} aria-label="Close account deletion dialog" className="grid h-9 w-9 place-items-center rounded-lg text-[#81796e] hover:bg-[#eee8de]"><X className="h-4 w-4" /></button>
              </Dialog.Close>
            </div>
            <Dialog.Title className="sr-only">Delete your account?</Dialog.Title>
            <Dialog.Description className="mt-4 text-sm leading-6 text-[#706a61]">This cannot be undone. Export your research first if you need a copy. Type <strong className="text-[#914148]">DELETE</strong>{initial.hasPassword ? " and enter your current password" : ""} to continue.</Dialog.Description>
            <div className="mt-5 grid gap-3">
              {initial.hasPassword && <Field label="Current password"><input type="password" value={deleteForm.password} onChange={(event) => setDeleteForm((current) => ({ ...current, password: event.target.value }))} disabled={deletingAccount} className={inputClass} /></Field>}
              <Field label="Confirmation"><input value={deleteForm.confirmation} onChange={(event) => setDeleteForm((current) => ({ ...current, confirmation: event.target.value }))} placeholder="Type DELETE" disabled={deletingAccount} className={inputClass} /></Field>
            </div>
            {deleteNotice && <p role="alert" className="mt-3 text-xs text-[#914148]">{deleteNotice}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button type="button" disabled={deletingAccount} className="h-10 rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-xs font-semibold text-[#8f1d2c]">Keep account</button>
              </Dialog.Close>
              <button type="button" onClick={submitDeleteAccount} disabled={!canDelete || deletingAccount} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#914148] px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
                {deletingAccount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}{deletingAccount ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
