"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getAuthCapabilities } from "@/lib/api";
import { Icons } from "@/components/ui/icons";

export function GoogleSignInButton({ onSignIn, disabled = false }) {
  const configuredFallback =
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const [status, setStatus] = useState({
    loading: true,
    enabled: configuredFallback,
    message: "Checking Google sign-in availability…",
  });

  useEffect(() => {
    const controller = new AbortController();

    getAuthCapabilities({ signal: controller.signal })
      .then((capabilities) => {
        if (controller.signal.aborted) return;
        const enabled = Boolean(capabilities?.google?.enabled);
        setStatus({
          loading: false,
          enabled,
          message: enabled
            ? ""
            : capabilities?.google?.message ||
              "Google sign-in is not configured in this environment.",
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus({
          loading: false,
          enabled: configuredFallback,
          message: configuredFallback
            ? ""
            : "Google sign-in availability could not be verified.",
        });
      });

    return () => controller.abort();
  }, [configuredFallback]);

  const unavailable = status.loading || !status.enabled;

  return (
    <div>
      <button
        type="button"
        onClick={onSignIn}
        disabled={disabled || unavailable}
        aria-describedby={unavailable ? "google-sign-in-status" : undefined}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#8f1d2c]/12 bg-white text-sm font-semibold text-[#26302c] shadow-sm transition hover:border-[#8f1d2c]/22 hover:bg-[#f6f2eb] disabled:cursor-not-allowed disabled:bg-[#f3efe8] disabled:text-[#777066] disabled:opacity-80"
      >
        {status.loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Icons.google className="h-4 w-4" aria-hidden="true" />
        )}
        Continue with Google
      </button>
      {unavailable && (
        <p
          id="google-sign-in-status"
          className="mt-2 text-center text-[11px] leading-5 text-[#81796e]"
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
