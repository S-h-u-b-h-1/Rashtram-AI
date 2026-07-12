"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import * as api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

const policyAreas = [
  "Constitutional law",
  "Finance",
  "Education",
  "Technology",
  "Health",
  "Environment",
  "Governance",
  "Foreign policy",
];
const documentTypes = ["Bills", "Acts", "Policies", "Gazette", "State laws"];
const jurisdictions = ["Union", "State", "Both"];

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
  const { user, checkAuthStatus } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: user?.name || "",
    organization: "",
    designation: "",
    location: "",
    languagePreference: "English",
    preferredPolicyAreas: [],
    preferredDocumentTypes: [],
    preferredJurisdictions: ["Union"],
  });

  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const finish = async ({ skipped = false } = {}) => {
    setSaving(true);
    setError("");
    try {
      await api.updateProfile({
        ...form,
        organization: skipped ? "" : form.organization,
        designation: skipped ? "" : form.designation,
        location: skipped ? "" : form.location,
        preferredPolicyAreas: skipped ? [] : form.preferredPolicyAreas,
        preferredDocumentTypes: skipped ? [] : form.preferredDocumentTypes,
        preferredJurisdictions: skipped ? [] : form.preferredJurisdictions,
        researchInterests: skipped
          ? []
          : [
              ...form.preferredPolicyAreas,
              ...form.preferredDocumentTypes,
            ],
        onboardingCompleted: !skipped,
        onboardingSkipped: skipped,
      });
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
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-4xl items-center justify-center">
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
              This helps rank documents, recommendations, and research shortcuts
              around your work. You can change it later in profile settings.
            </p>
          </div>

          <div className="mb-7 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className={`h-1.5 rounded-full transition ${
                  item <= step ? "bg-[#8f1d2c]" : "bg-[#8f1d2c]/10"
                }`}
              />
            ))}
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
              <motion.div
                key="identity"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="grid gap-4"
              >
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
                  <Input
                    label="Role / designation"
                    value={form.designation}
                    onChange={(value) => update("designation", value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Location"
                    value={form.location}
                    onChange={(value) => update("location", value)}
                  />
                  <Select
                    label="Preferred language"
                    value={form.languagePreference}
                    onChange={(value) => update("languagePreference", value)}
                    options={["English", "Hindi", "Bilingual"]}
                  />
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="interests"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="space-y-5"
              >
                <ChoiceGroup
                  title="Policy areas"
                  options={policyAreas}
                  selected={form.preferredPolicyAreas}
                  onToggle={(value) =>
                    update(
                      "preferredPolicyAreas",
                      toggle(form.preferredPolicyAreas, value),
                    )
                  }
                />
                <ChoiceGroup
                  title="Jurisdiction focus"
                  options={jurisdictions}
                  selected={form.preferredJurisdictions}
                  onToggle={(value) =>
                    update(
                      "preferredJurisdictions",
                      toggle(form.preferredJurisdictions, value),
                    )
                  }
                />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
              >
                <ChoiceGroup
                  title="Preferred document types"
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
              onClick={() =>
                step < 2
                  ? setStep((current) => current + 1)
                  : finish({ skipped: false })
              }
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
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
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
          const active = selected.includes(option);
          return (
            <button
              type="button"
              key={option}
              onClick={() => onToggle(option)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                active
                  ? "border-[#8f1d2c] bg-[#8f1d2c] text-[#fffaf0] shadow-sm"
                  : "border-[#8f1d2c]/12 bg-white text-[#62544d] hover:border-[#8f1d2c]/35"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}
