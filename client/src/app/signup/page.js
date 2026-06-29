"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Chrome, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PublicRoute from "@/components/PublicRoute";
import { AuthShell } from "@/components/AuthShell";
import { Checkbox } from "@/components/ui/checkbox";

const strongPassword =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { register, googleLogin, loading } = useAuth();

  const handleSignup = async (event) => {
    event.preventDefault();
    setError("");

    if (!name || !email || !password || !confirmPassword) {
      setError("Complete all fields to create your workspace.");
      return;
    }
    if (!strongPassword.test(password)) {
      setError(
        "Use 8+ characters with uppercase, lowercase, a number, and a special character.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (!agreeTerms) {
      setError("Please accept the terms to continue.");
      return;
    }

    const result = await register(name, email, password);
    if (!result.success) setError(result.error);
  };

  return (
    <PublicRoute>
      <AuthShell
        eyebrow="Create your workspace"
        title="Begin with a question."
        description="Create an account to research bills, acts, and their policy implications."
      >
        <button
          type="button"
          onClick={googleLogin}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#8f1d2c]/12 bg-white text-sm font-semibold text-[#26302c] shadow-sm transition hover:border-[#8f1d2c]/22 hover:bg-[#f6f2eb] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Chrome className="h-4 w-4" />
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#8f1d2c]/10" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#898176]">
            or use email
          </span>
          <div className="h-px flex-1 bg-[#8f1d2c]/10" />
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[#984b4f]/20 bg-[#984b4f]/7 px-4 py-3 text-sm text-[#914148]"
            >
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-[#323a36]"
              >
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={loading}
                required
                className="h-12 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-sm placeholder:text-[#9c9589] focus:border-[#a85a52] focus:outline-none focus:ring-4 focus:ring-[#a85a52]/10"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-[#323a36]"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@organisation.org"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                required
                className="h-12 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-sm placeholder:text-[#9c9589] focus:border-[#a85a52] focus:outline-none focus:ring-4 focus:ring-[#a85a52]/10"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-[#323a36]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  required
                  className="h-12 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 pr-11 text-sm focus:border-[#a85a52] focus:outline-none focus:ring-4 focus:ring-[#a85a52]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#7e776d]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-medium text-[#323a36]"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={loading}
                required
                className="h-12 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-sm focus:border-[#a85a52] focus:outline-none focus:ring-4 focus:ring-[#a85a52]/10"
              />
            </div>
          </div>

          <p className="flex items-start gap-2 text-xs leading-5 text-[#817a70]">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#39715f]" />
            8+ characters with uppercase, lowercase, number, and special
            character.
          </p>

          <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-[#625d55]">
            <Checkbox
              id="terms"
              checked={agreeTerms}
              onCheckedChange={setAgreeTerms}
              disabled={loading}
              className="mt-0.5"
            />
            I agree to use Rashtram AI responsibly and verify important policy
            conclusions against primary sources.
          </label>

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#8f1d2c] text-sm font-semibold text-[#fffaf0] shadow-[0_12px_28px_rgba(143, 29, 44,0.16)] transition hover:-translate-y-0.5 hover:bg-[#2d3934] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating workspace…" : "Create workspace"}
          </button>
        </form>

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
