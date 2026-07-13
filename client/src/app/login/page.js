"use client";

import { useState } from "react";
import Link from "next/link";
import { Chrome, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PublicRoute from "@/components/PublicRoute";
import { AuthShell } from "@/components/AuthShell";
import { Checkbox } from "@/components/ui/checkbox";

export default function Login() {
  const googleAuthEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { login, googleLogin, loading } = useAuth();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }

    const result = await login(email, password, rememberMe);
    if (!result.success) setError(result.error);
  };

  return (
    <PublicRoute>
      <AuthShell
        eyebrow="Welcome back"
        title="Continue your research."
        description="Sign in to return to saved documents, conversations, notes, and collections."
      >
        {googleAuthEnabled && <button
          type="button"
          onClick={googleLogin}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#8f1d2c]/12 bg-white text-sm font-semibold text-[#26302c] shadow-sm transition hover:border-[#8f1d2c]/22 hover:bg-[#f6f2eb] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Chrome className="h-4 w-4" />
          Continue with Google
        </button>}

        {googleAuthEnabled && <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#8f1d2c]/10" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#898176]">
            or use email
          </span>
          <div className="h-px flex-1 bg-[#8f1d2c]/10" />
        </div>}

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[#984b4f]/20 bg-[#984b4f]/7 px-4 py-3 text-sm text-[#914148]"
            >
              {error}
            </div>
          )}

          <div>
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
              className="h-12 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-sm text-[#8f1d2c] placeholder:text-[#9c9589] transition focus:border-[#a85a52] focus:outline-none focus:ring-4 focus:ring-[#a85a52]/10 disabled:opacity-60"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[#323a36]"
              >
                Password
              </label>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                required
                className="h-12 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 pr-12 text-sm text-[#8f1d2c] placeholder:text-[#9c9589] transition focus:border-[#a85a52] focus:outline-none focus:ring-4 focus:ring-[#a85a52]/10 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[#7e776d] hover:text-[#8f1d2c]"
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

          <label className="flex cursor-pointer items-center gap-3 text-sm text-[#625d55]">
            <Checkbox
              id="rememberMe"
              checked={rememberMe}
              onCheckedChange={setRememberMe}
              disabled={loading}
            />
            Keep me signed in on this device
          </label>

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#8f1d2c] text-sm font-semibold text-[#fffaf0] shadow-[0_12px_28px_rgba(143, 29, 44,0.16)] transition hover:-translate-y-0.5 hover:bg-[#2d3934] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-[#706a61]">
          New to Rashtram?{" "}
          <Link
            href="/signup"
            className="font-semibold text-[#874049] underline decoration-[#874049]/25 underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      </AuthShell>
    </PublicRoute>
  );
}
