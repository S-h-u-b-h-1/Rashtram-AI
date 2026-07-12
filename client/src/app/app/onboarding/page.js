"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import * as api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

const roleOptions = [
  ["Student", "student"],
  ["Researcher", "researcher"],
  ["Policy professional", "policy_professional"],
  ["Lawyer", "lawyer"],
  ["Chartered accountant", "chartered_accountant"],
  ["Company secretary", "company_secretary"],
  ["Business owner", "business_owner"],
  ["Compliance professional", "compliance_professional"],
  ["Journalist", "journalist"],
  ["Government professional", "government_professional"],
  ["Faculty", "faculty"],
  ["Other", "other"],
];

const primaryUseOptions = [
  ["Academic research", "academic_research"],
  ["Legal research", "legal_research"],
  ["Compliance monitoring", "compliance_monitoring"],
  ["Business policy intelligence", "business_policy_intelligence"],
  ["Civil services preparation", "civil_services_preparation"],
  ["Journalism", "journalism"],
  ["Government research", "government_research"],
  ["Other", "other"],
];

const policyAreas = [
  "Constitutional law",
  "Finance",
  "Education",
  "Technology",
  "Health",
  "Environment",
  "Governance",
  "Foreign policy",
  "Taxation",
  "Corporate law",
  "Labour",
  "Infrastructure",
];

const documentTypes = [
  ["Bills", "bill"],
  ["State Bills", "state_bill"],
  ["Acts", "act"],
  ["Policies", "policy"],
  ["Gazette", "gazette"],
  ["Rules", "rule"],
  ["Circulars", "circular"],
  ["Reports", "report"],
];

const states = [
  "Andhra Pradesh",
  "Delhi",
  "Gujarat",
  "Haryana",
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Uttar Pradesh",
  "West Bengal",
];

const ministries = [
  "Finance",
  "Education",
  "Health and Family Welfare",
  "Corporate Affairs",
  "Law and Justice",
  "Environment",
  "Electronics and IT",
  "Commerce and Industry",
];

const languageOptions = [
  ["English", "english"],
  ["Hindi", "hindi"],
  ["Bilingual", "bilingual"],
];

const toggle = (items, value) =>
  items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingContent />
    </ProtectedRoute>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const { user, profile, preferences, checkAuthStatus } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    name: user?.name || "",
    organization: profile?.organization || "",
    role: profile?.role || "student",
    designation: profile?.designation || "",
    location: profile?.location || "",
    timezone: profile?.timezone || "Asia/Kolkata",
    preferredLanguage: preferences?.preferredLanguage || "english",
    primaryUse: preferences?.primaryUse || "academic_research",
    preferredTopics: preferences?.preferredTopics || [],
    preferredDocumentTypes: preferences?.preferredDocumentTypes || ["bill", "act"],
    preferredJurisdictions: preferences?.preferredJurisdictions || ["Union"],
    preferredStates: preferences?.preferredStates || [],
    preferredMinistries: preferences?.preferredMinistries || [],
    industries: preferences?.industries || [],
    researchDescription: preferences?.researchDescription || "",
    notificationPreferences: preferences?.notificationPreferences || {
      emailDigest: true,
      productUpdates: true,
    },
  }));

  const progress = useMemo(() => ((step + 1) / 3) * 100, [step]);

  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const payload = (skipped = false) => ({
    profile: {
      name: form.name,
      organization: skipped ? "" : form.organization,
      role: skipped ? "" : form.role,
      designation: skipped ? "" : form.designation,
      location: skipped ? "" : form.location,
      timezone: form.timezone,
    },
    preferences: {
      preferredLanguage: form.preferredLanguage,
      primaryUse: skipped ? "" : form.primaryUse,
      preferredTopics: skipped ? [] : form.preferredTopics,
      researchInterests: skipped
        ? []
        : [...form.preferredTopics, ...form.preferredDocumentTypes],
      preferredDocumentTypes: skipped ? [] : form.preferredDocumentTypes,
      preferredJurisdictions: skipped ? [] : form.preferredJurisdictions,
      preferredStates: skipped ? [] : form.preferredStates,
      preferredMinistries: skipped ? [] : form.preferredMinistries,
      industries: skipped ? [] : form.industries,
      researchDescription: skipped ? "" : form.researchDescription,
      notificationPreferences: form.notificationPreferences,
    },
  });

  const validateStep = () => {
    if (step === 0 && !form.name.trim()) return "Please enter your name.";
    if (step === 0 && !form.role) return "Please select your role.";
    if (step === 1 && form.preferredDocumentTypes.length === 0) {
      return "Select at least one document type.";
    }
    return "";
  };

  const goNext = async () => {
    const validation = validateStep();
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }
    await finish({ skipped: false });
  };

  const finish = async ({ skipped = false } = {}) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (skipped) {
        await api.skipOnboarding();
      } else {
        await api.completeOnboarding(payload(false));
      }
      await checkAuthStatus();
      router.push("/app");
    } catch (requestError) {
      setError(requestError.message || "Profile setup could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#f5efe5] px-4 py-8 text-[#2f2723]">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl items-center justify-center">
        <section className="relative w-full overflow-hidden rounded-[2rem] border border-[#8f1d2c]/10 bg-white/82 p-6 shadow-[0_30px_80px_rgba(50,34,27,0.12)] backdrop-blur md:p-10">
          <button
            type="button"
            onClick={() => finish({ skipped: true })}
            disabled={saving}
            className="absolute right-5 top-5 rounded-full border border-[#8f1d2c]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#7c352f] shadow-sm transition hover:bg-[#f6f2eb] disabled:opacity-50"
          >
            Skip
          </button>

          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8f1d2c]">
              Setup · Step {step + 1} of 3
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#241a17] md:text-5xl">
              Personalize your Rashtram AI workspace.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#746a60]">
              These choices are stored with your account and used to rank the
              dashboard, recommendations, and research shortcuts. You can edit
              them later from profile settings.
            </p>
          </div>

          <div className="mb-7 overflow-hidden rounded-full bg-[#8f1d2c]/10">
            <div
              className="h-1.5 rounded-full bg-[#8f1d2c] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-[#984b4f]/20 bg-[#984b4f]/7 px-4 py-3 text-sm text-[#914148]"
            >
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div {...stepMotion("identity")} className="grid gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-[#8f1d2c]" />
                  Your research context
                </div>
                <Input
                  label="Full name"
                  value={form.name}
                  onChange={(value) => update("name", value)}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Organization"
                    value={form.organization}
                    onChange={(value) => update("organization", value)}
                  />
                  <Select
                    label="Role"
                    value={form.role}
                    onChange={(value) => update("role", value)}
                    options={roleOptions}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Designation"
                    value={form.designation}
                    onChange={(value) => update("designation", value)}
                  />
                  <Input
                    label="Location"
                    value={form.location}
                    onChange={(value) => update("location", value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Timezone"
                    value={form.timezone}
                    onChange={(value) => update("timezone", value)}
                  />
                  <Select
                    label="Preferred response language"
                    value={form.preferredLanguage}
                    onChange={(value) => update("preferredLanguage", value)}
                    options={languageOptions}
                  />
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div {...stepMotion("preferences")} className="space-y-5">
                <Select
                  label="Primary use"
                  value={form.primaryUse}
                  onChange={(value) => update("primaryUse", value)}
                  options={primaryUseOptions}
                />
                <ChoiceGroup
                  title="Policy areas"
                  options={policyAreas}
                  selected={form.preferredTopics}
                  onToggle={(value) =>
                    update("preferredTopics", toggle(form.preferredTopics, value))
                  }
                />
                <ChoiceGroup
                  title="Document types"
                  options={documentTypes}
                  selected={form.preferredDocumentTypes}
                  onToggle={(value) =>
                    update(
                      "preferredDocumentTypes",
                      toggle(form.preferredDocumentTypes, value),
                    )
                  }
                />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div {...stepMotion("scope")} className="space-y-5">
                <ChoiceGroup
                  title="Preferred jurisdictions"
                  options={["Union", "State", "Both"]}
                  selected={form.preferredJurisdictions}
                  onToggle={(value) =>
                    update(
                      "preferredJurisdictions",
                      toggle(form.preferredJurisdictions, value),
                    )
                  }
                />
                <ChoiceGroup
                  title="States to watch"
                  options={states}
                  selected={form.preferredStates}
                  onToggle={(value) =>
                    update("preferredStates", toggle(form.preferredStates, value))
                  }
                />
                <ChoiceGroup
                  title="Ministries to watch"
                  options={ministries}
                  selected={form.preferredMinistries}
                  onToggle={(value) =>
                    update(
                      "preferredMinistries",
                      toggle(form.preferredMinistries, value),
                    )
                  }
                />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#323a36]">
                    Research goals
                  </span>
                  <textarea
                    value={form.researchDescription}
                    onChange={(event) =>
                      update("researchDescription", event.target.value)
                    }
                    rows={4}
                    className="w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 py-3 text-sm placeholder:text-[#9c9589] focus:border-[#a85a52] focus:outline-none focus:ring-4 focus:ring-[#a85a52]/10"
                    placeholder="Example: monitor education bills, compliance obligations, and fiscal policy changes."
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={saving || step === 0}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#8f1d2c]/12 bg-white text-sm font-semibold text-[#513d38] transition hover:bg-[#f6f2eb] disabled:opacity-45"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={saving}
              className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#8f1d2c] text-sm font-semibold text-[#fffaf0] shadow-[0_12px_28px_rgba(143,29,44,0.16)] transition hover:-translate-y-0.5 hover:bg-[#2d3934] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {step < 2 ? "Continue" : saving ? "Saving…" : "Finish setup"}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

const stepMotion = (key) => ({
  key,
  initial: { opacity: 0, y: 12, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(4px)" },
  transition: { duration: 0.22, ease: "easeOut" },
});

function Input({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#323a36]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-sm placeholder:text-[#9c9589] focus:border-[#a85a52] focus:outline-none focus:ring-4 focus:ring-[#a85a52]/10"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#323a36]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-sm focus:border-[#a85a52] focus:outline-none focus:ring-4 focus:ring-[#a85a52]/10"
      >
        {options.map((option) => {
          const [labelText, optionValue] = Array.isArray(option)
            ? option
            : [option, option];
          return (
            <option key={optionValue} value={optionValue}>
              {labelText}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function ChoiceGroup({ title, options, selected, onToggle }) {
  return (
    <section className="rounded-2xl border border-[#8f1d2c]/10 bg-[#fffaf4] p-5">
      <h2 className="text-sm font-semibold text-[#352723]">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => {
          const [label, value] = Array.isArray(option) ? option : [option, option];
          const active = selected.includes(value);
          return (
            <button
              type="button"
              key={value}
              onClick={() => onToggle(value)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                active
                  ? "border-[#8f1d2c] bg-[#8f1d2c] text-[#fffaf0] shadow-sm"
                  : "border-[#8f1d2c]/12 bg-white text-[#62544d] hover:border-[#8f1d2c]/35"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
