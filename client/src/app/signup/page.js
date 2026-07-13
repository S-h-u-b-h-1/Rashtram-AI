"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PublicRoute from "@/components/PublicRoute";
import { AuthShell } from "@/components/AuthShell";
import { Checkbox } from "@/components/ui/checkbox";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const strongPassword =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;

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
const documentTypeValue = {
  Bills: "bill",
  Acts: "act",
  Policies: "policy",
  Gazette: "gazette",
  "State laws": "state_bill",
};

const jurisdictions = ["Union", "State", "Both"];

const stepMotion = {
  initial: { opacity: 0, x: 18, filter: "blur(4px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: -18, filter: "blur(4px)" },
  transition: { duration: 0.22, ease: "easeOut" },
};

const toggle = (items, value) =>
  items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];

export default function Signup() {
  const router = useRouter();
  const { register, googleLogin, loading, checkAuthStatus } = useAuth();
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
    organization: "",
    designation: "",
    location: "",
    languagePreference: "English",
    preferredPolicyAreas: [],
    preferredDocumentTypes: [],
    preferredJurisdictions: ["Union"],
  });

  const submitting = loading || savingProfile;
  const progress = useMemo(() => ((step + 1) / 3) * 100, [step]);

  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const validateAccount = () => {
    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      return "Complete all account fields to continue.";
    }
    if (!strongPassword.test(form.password)) {
      return "Use 8+ characters with uppercase, lowercase, a number, and a special character.";
    }
    if (form.password !== form.confirmPassword) {
      return "The passwords do not match.";
    }
    if (!form.agreeTerms) {
      return "Please accept the responsible-use note to continue.";
    }
    return "";
  };

  const nextStep = () => {
    setError("");
    if (step === 0) {
      const accountError = validateAccount();
      if (accountError) {
        setError(accountError);
        return;
      }
    }
    setStep((current) => Math.min(current + 1, 2));
  };

  const completeSignup = async ({ skipped = false } = {}) => {
    setError("");
    const accountError = validateAccount();
    if (accountError) {
      setStep(0);
      setError(accountError);
      return;
    }
    const result = await register(form.name, form.email, form.password, {
      redirectTo: null,
      persistent: true,
      hydrate: false,
    });
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSavingProfile(true);
    try {
      if (skipped) {
        await api.skipOnboarding();
      } else {
        const preferredDocumentTypes = form.preferredDocumentTypes
          .map((type) => documentTypeValue[type] || type)
          .filter(Boolean);
        await api.completeOnboarding({
          profile: {
            name: form.name,
            organization: form.organization,
            role: "student",
            designation: form.designation,
            location: form.location,
            timezone: "Asia/Kolkata",
          },
          preferences: {
            preferredLanguage: form.languagePreference,
            preferredTopics: form.preferredPolicyAreas,
            preferredDocumentTypes,
            preferredJurisdictions: form.preferredJurisdictions,
            researchInterests: [
              ...form.preferredPolicyAreas,
              ...preferredDocumentTypes,
            ],
            notificationPreferences: {
              emailDigest: true,
              productUpdates: true,
            },
          },
        });
      }
      await checkAuthStatus();
      router.push("/app");
    } catch (requestError) {
      setError(
        requestError.message ||
          "Your account was created, but profile setup could not be saved.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const skipProfile = () => completeSignup({ skipped: true });

  return (
    <PublicRoute>
      <AuthShell
        eyebrow={`Step ${step + 1} of 3`}
        title="Create a research workspace."
        description="Set up Rashtram AI around your role, policy interests, and preferred research material."
      >
        <button
          type="button"
          onClick={skipProfile}
          disabled={submitting}
          className="absolute right-6 top-6 rounded-full border border-[#8f1d2c]/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#7c352f] shadow-sm backdrop-blur transition hover:bg-[#f6f2eb] disabled:opacity-50"
        >
          Skip setup
        </button>

        <div className="mb-6 overflow-hidden rounded-full bg-[#8f1d2c]/10">
          <div
            className="h-1.5 rounded-full bg-[#8f1d2c] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.form
              key="account"
              {...stepMotion}
              onSubmit={(event) => {
                event.preventDefault();
                nextStep();
              }}
              className="space-y-4"
            >
              <GoogleSignInButton
                onSignIn={googleLogin}
                disabled={submitting}
              />

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#8f1d2c]/10" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#898176]">
                  or use email
                </span>
                <div className="h-px flex-1 bg-[#8f1d2c]/10" />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#984b4f]/20 bg-[#984b4f]/7 px-4 py-3 text-sm text-[#914148]"
                >
                  {error}
                </div>
              )}

              <Field label="Full name" htmlFor="name">
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  disabled={submitting}
                  required
                  className="auth-input"
                />
              </Field>

              <Field label="Email address" htmlFor="email">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  disabled={submitting}
                  required
                  className="auth-input"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password" htmlFor="password">
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) =>
                        update("password", event.target.value)
                      }
                      disabled={submitting}
                      required
                      className="auth-input pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#7e776d]"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>

                <Field label="Confirm password" htmlFor="confirmPassword">
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(event) =>
                      update("confirmPassword", event.target.value)
                    }
                    disabled={submitting}
                    required
                    className="auth-input"
                  />
                </Field>
              </div>

              <p className="flex items-start gap-2 text-xs leading-5 text-[#817a70]">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#39715f]" />
                8+ characters with uppercase, lowercase, number, and special
                character.
              </p>

              <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-[#625d55]">
                <Checkbox
                  id="terms"
                  checked={form.agreeTerms}
                  onCheckedChange={(checked) =>
                    update("agreeTerms", Boolean(checked))
                  }
                  disabled={submitting}
                  className="mt-0.5"
                />
                I agree to use Rashtram AI responsibly and verify important
                policy conclusions against primary sources.
              </label>

              <PrimaryButton loading={submitting}>Continue</PrimaryButton>
            </motion.form>
          )}

          {step === 1 && (
            <motion.div key="profile" {...stepMotion} className="space-y-4">
              {error && <ErrorNotice>{error}</ErrorNotice>}
              <div className="rounded-2xl border border-[#8f1d2c]/10 bg-[#fffaf4] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#3a211f]">
                  <Sparkles className="h-4 w-4 text-[#8f1d2c]" />
                  Tell us where your research happens
                </div>
                <div className="grid gap-4">
                  <Field label="Organization" htmlFor="organization">
                    <input
                      id="organization"
                      value={form.organization}
                      onChange={(event) =>
                        update("organization", event.target.value)
                      }
                      disabled={submitting}
                      placeholder="University, firm, newsroom, policy team"
                      className="auth-input"
                    />
                  </Field>
                  <Field label="Role / designation" htmlFor="designation">
                    <input
                      id="designation"
                      value={form.designation}
                      onChange={(event) =>
                        update("designation", event.target.value)
                      }
                      disabled={submitting}
                      placeholder="Researcher, student, analyst, lawyer"
                      className="auth-input"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Location" htmlFor="location">
                      <input
                        id="location"
                        value={form.location}
                        onChange={(event) =>
                          update("location", event.target.value)
                        }
                        disabled={submitting}
                        placeholder="Delhi, Mumbai, Bengaluru"
                        className="auth-input"
                      />
                    </Field>
                    <Field label="Preferred language" htmlFor="language">
                      <select
                        id="language"
                        value={form.languagePreference}
                        onChange={(event) =>
                          update("languagePreference", event.target.value)
                        }
                        disabled={submitting}
                        className="auth-input"
                      >
                        <option>English</option>
                        <option>Hindi</option>
                        <option>Bilingual</option>
                      </select>
                    </Field>
                  </div>
                </div>
              </div>
              <NavButtons
                onBack={() => setStep(0)}
                onNext={nextStep}
                submitting={submitting}
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="preferences" {...stepMotion} className="space-y-5">
              {error && <ErrorNotice>{error}</ErrorNotice>}
              <ChoiceGroup
                title="Policy areas"
                description="Used for dashboard ranking and recommendations."
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
                title="Document types"
                description="Used to prioritize catalogue sections."
                options={documentTypes}
                selected={form.preferredDocumentTypes}
                onToggle={(value) =>
                  update(
                    "preferredDocumentTypes",
                    toggle(form.preferredDocumentTypes, value),
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

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#8f1d2c]/12 bg-white text-sm font-semibold text-[#513d38] transition hover:bg-[#f6f2eb] disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => completeSignup({ skipped: false })}
                  disabled={submitting}
                  className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#8f1d2c] text-sm font-semibold text-[#fffaf0] shadow-[0_12px_28px_rgba(143,29,44,0.16)] transition hover:-translate-y-0.5 hover:bg-[#2d3934] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Creating workspace…" : "Finish setup"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-6 text-center text-sm text-[#706a61]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#874049] underline decoration-[#874049]/25 underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </AuthShell>
    </PublicRoute>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-[#323a36]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorNotice({ children }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[#984b4f]/20 bg-[#984b4f]/7 px-4 py-3 text-sm text-[#914148]"
    >
      {children}
    </div>
  );
}

function PrimaryButton({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#8f1d2c] text-sm font-semibold text-[#fffaf0] shadow-[0_12px_28px_rgba(143,29,44,0.16)] transition hover:-translate-y-0.5 hover:bg-[#2d3934] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
      {!loading && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}

function NavButtons({ onBack, onNext, submitting }) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#8f1d2c]/12 bg-white text-sm font-semibold text-[#513d38] transition hover:bg-[#f6f2eb] disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={submitting}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#8f1d2c] text-sm font-semibold text-[#fffaf0] transition hover:bg-[#2d3934] disabled:opacity-50"
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ChoiceGroup({ title, description, options, selected, onToggle }) {
  return (
    <section className="rounded-2xl border border-[#8f1d2c]/10 bg-white/75 p-4">
      <h3 className="text-sm font-semibold text-[#352723]">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-[#7b7168]">{description}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
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
                  : "border-[#8f1d2c]/12 bg-[#fbf7ef] text-[#62544d] hover:border-[#8f1d2c]/35"
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
