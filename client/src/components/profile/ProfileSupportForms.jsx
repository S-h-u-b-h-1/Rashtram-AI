"use client";

import { Bug, Loader2, MessageSquareText, Send } from "lucide-react";
import { useRef, useState } from "react";
import { submitContactRequest } from "@/lib/api";

const EMPTY = {
  category: "",
  message: "",
  page: "",
  expectedBehavior: "",
  actualBehavior: "",
  stepsToReproduce: "",
  severity: "",
  email: "",
  screenshotUrl: "",
  _gotcha: "",
};
const inputClass =
  "h-11 w-full rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-sm text-[#29312d] outline-none focus:border-[#a85a52] focus:ring-4 focus:ring-[#a85a52]/10";

function Field({ label, required = false, wide = false, children }) {
  return (
    <label className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#706a61]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

export function ProfileSupportForms({ defaultEmail = "" }) {
  const [kind, setKind] = useState("");
  const [values, setValues] = useState({ ...EMPTY, email: defaultEmail });
  const [status, setStatus] = useState("idle");
  const [notice, setNotice] = useState("");
  const submittingRef = useRef(false);

  const update = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (status !== "idle") {
      setStatus("idle");
      setNotice("");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email);
    const valid =
      kind === "feedback"
        ? values.category && values.message.trim()
        : values.page.trim() &&
          values.expectedBehavior.trim() &&
          values.actualBehavior.trim() &&
          values.stepsToReproduce.trim() &&
          values.severity;
    if (!emailValid || !valid) {
      setStatus("error");
      setNotice("Complete all required fields and enter a valid email.");
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    setNotice("");
    try {
      await submitContactRequest({
        requestType: kind === "bug" ? "Bug report" : "Product feedback",
        ...values,
        _replyto: values.email,
        _subject:
          kind === "bug"
            ? "New Rashtram AI Bug Report"
            : "New Rashtram AI Product Feedback",
        submittedAt: new Date().toISOString(),
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
      });
      setStatus("success");
      setNotice(
        kind === "bug"
          ? "Thank you. Your bug report has been sent to the Rashtram AI team."
          : "Thank you. Your feedback has been sent to the Rashtram AI team.",
      );
      setValues({ ...EMPTY, email: defaultEmail });
    } catch {
      setStatus("error");
      setNotice(
        "We could not send this right now. Please try again or email rashtram.ai@rishihood.edu.in directly.",
      );
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <section className="surface-card p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
        Product support
      </p>
      <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
        Help improve Rashtram AI
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setKind(kind === "feedback" ? "" : "feedback")}
          className="inline-flex items-center gap-2 rounded-xl bg-[#8f1d2c] px-4 py-2.5 text-xs font-semibold text-white"
        >
          <MessageSquareText className="h-4 w-4" />
          Send Feedback
        </button>
        <button
          type="button"
          onClick={() => setKind(kind === "bug" ? "" : "bug")}
          className="inline-flex items-center gap-2 rounded-xl border border-[#8f1d2c]/12 bg-white px-4 py-2.5 text-xs font-semibold text-[#8f1d2c]"
        >
          <Bug className="h-4 w-4" />
          Report a Bug
        </button>
      </div>

      {kind && (
        <form
          onSubmit={submit}
          className="mt-5 grid gap-4 rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-4 sm:grid-cols-2"
        >
          <input
            tabIndex={-1}
            autoComplete="off"
            value={values._gotcha}
            onChange={(event) => update("_gotcha", event.target.value)}
            className="hidden"
            aria-hidden="true"
          />
          {kind === "feedback" ? (
            <>
              <Field label="Category" required>
                <select
                  required
                  value={values.category}
                  onChange={(event) => update("category", event.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose category</option>
                  <option value="Product">Product</option>
                  <option value="Data quality">Data quality</option>
                  <option value="Research workflow">Research workflow</option>
                  <option value="Accessibility">Accessibility</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Screenshot or page URL">
                <input
                  value={values.screenshotUrl}
                  onChange={(event) =>
                    update("screenshotUrl", event.target.value)
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Feedback" required wide>
                <textarea
                  required
                  rows={4}
                  value={values.message}
                  onChange={(event) => update("message", event.target.value)}
                  className={`${inputClass} h-auto resize-y py-3`}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Page" required>
                <input
                  required
                  value={values.page}
                  onChange={(event) => update("page", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Severity" required>
                <select
                  required
                  value={values.severity}
                  onChange={(event) => update("severity", event.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose severity</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Release blocker">Release blocker</option>
                </select>
              </Field>
              {[
                ["expectedBehavior", "Expected behavior"],
                ["actualBehavior", "Actual behavior"],
                ["stepsToReproduce", "Steps to reproduce"],
              ].map(([key, label]) => (
                <Field key={key} label={label} required wide>
                  <textarea
                    required
                    rows={3}
                    value={values[key]}
                    onChange={(event) => update(key, event.target.value)}
                    className={`${inputClass} h-auto resize-y py-3`}
                  />
                </Field>
              ))}
            </>
          )}
          <Field label="Email" required wide>
            <input
              required
              type="email"
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={status === "submitting"}
              className="inline-flex items-center gap-2 rounded-xl bg-[#8f1d2c] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {status === "submitting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {status === "submitting" ? "Sending…" : "Submit"}
            </button>
            {notice && (
              <p
                role="status"
                className={`text-xs ${
                  status === "success" ? "text-[#315a49]" : "text-[#85434a]"
                }`}
              >
                {notice}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
