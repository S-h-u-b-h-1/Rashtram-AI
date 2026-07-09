"use client";

import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { submitContactRequest } from "@/lib/api";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  organization: "",
  email: "",
  phone: "",
  message: "",
  _gotcha: "",
};

const FIELDS = [
  {
    name: "firstName",
    label: "First name",
    required: true,
    autoComplete: "given-name",
  },
  {
    name: "lastName",
    label: "Last name",
    autoComplete: "family-name",
  },
  {
    name: "organization",
    label: "Organization",
    autoComplete: "organization",
    wide: true,
  },
  {
    name: "email",
    label: "Email",
    required: true,
    type: "email",
    autoComplete: "email",
  },
  {
    name: "phone",
    label: "Phone",
    type: "tel",
    autoComplete: "tel",
  },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUCCESS_MESSAGE =
  "Thank you. Your message has been sent to the Rashtram AI team.";

const validate = (form) => {
  const errors = {};
  if (!form.firstName.trim()) {
    errors.firstName = "Enter your first name.";
  }
  if (!form.email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!form.message.trim()) {
    errors.message = "Enter a message.";
  }
  return errors;
};

export default function ContactPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const submittingRef = useRef(false);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    if (status !== "idle" && status !== "submitting") {
      setStatus("idle");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus("idle");
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    try {
      await submitContactRequest({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        organization: form.organization.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim(),
        submittedAt: new Date().toISOString(),
        pageUrl: window.location.href,
        userAgent: window.navigator.userAgent,
        _gotcha: form._gotcha,
        _subject: "New Rashtram AI Contact Form Submission",
        _replyto: form.email.trim(),
      });
      setForm(EMPTY_FORM);
      setErrors({});
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      submittingRef.current = false;
    }
  };

  const fieldClass =
    "mt-2 h-12 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-sm text-[#29312d] outline-none transition focus:border-[#a85a52] focus:ring-4 focus:ring-[#a85a52]/10 disabled:cursor-not-allowed disabled:opacity-60";
  const isSubmitting = status === "submitting";

  return (
    <main className="min-h-dvh bg-[#eee8df] px-5 py-12 sm:py-16 lg:py-20">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-[#8f1d2c]/9 bg-[#f8f4ed] p-6 shadow-sm sm:p-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
          Contact Rashtram AI
        </p>
        <h1 className="mt-3 font-serif text-4xl text-[#8f1d2c]">
          Tell us what you are researching
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#706a61]">
          Send a product question, data-source issue, or research workflow
          request. Your message is sent securely to the Rashtram AI team.
        </p>

        <form
          onSubmit={submit}
          noValidate
          className="mt-8 grid gap-5 sm:grid-cols-2"
        >
          <div
            aria-hidden="true"
            className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
          >
            <label htmlFor="contact-gotcha">Leave this field empty</label>
            <input
              id="contact-gotcha"
              name="_gotcha"
              type="text"
              value={form._gotcha}
              onChange={update}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {FIELDS.map(
            ({
              name,
              label,
              required,
              type = "text",
              autoComplete,
              wide,
            }) => {
              const errorId = `${name}-error`;
              return (
                <div key={name} className={wide ? "sm:col-span-2" : ""}>
                  <label
                    htmlFor={name}
                    className="text-xs font-semibold text-[#514d46]"
                  >
                    {label}
                    {required && (
                      <span className="ml-1 text-[#9b2638]" aria-hidden="true">
                        *
                      </span>
                    )}
                  </label>
                  <input
                    id={name}
                    name={name}
                    type={type}
                    required={required}
                    value={form[name]}
                    onChange={update}
                    autoComplete={autoComplete}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors[name])}
                    aria-describedby={errors[name] ? errorId : undefined}
                    className={`${fieldClass} ${
                      errors[name]
                        ? "border-[#9b2638] focus:border-[#9b2638] focus:ring-[#9b2638]/10"
                        : ""
                    }`}
                  />
                  {errors[name] && (
                    <p
                      id={errorId}
                      className="mt-1.5 text-xs text-[#9b2638]"
                    >
                      {errors[name]}
                    </p>
                  )}
                </div>
              );
            },
          )}

          <div className="sm:col-span-2">
            <label
              htmlFor="message"
              className="text-xs font-semibold text-[#514d46]"
            >
              Message
              <span className="ml-1 text-[#9b2638]" aria-hidden="true">
                *
              </span>
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={6}
              value={form.message}
              onChange={update}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "message-error" : undefined}
              className={`${fieldClass} h-auto py-3 ${
                errors.message
                  ? "border-[#9b2638] focus:border-[#9b2638] focus:ring-[#9b2638]/10"
                  : ""
              }`}
            />
            {errors.message && (
              <p
                id="message-error"
                className="mt-1.5 text-xs text-[#9b2638]"
              >
                {errors.message}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#8f1d2c] px-5 text-sm font-semibold text-white transition hover:bg-[#7c1926] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {isSubmitting ? "Sending…" : "Send message"}
            </button>

            <div aria-live="polite" aria-atomic="true">
              {status === "success" && (
                <p className="mt-3 text-sm text-[#315a49]">{SUCCESS_MESSAGE}</p>
              )}
              {status === "error" && (
                <p className="mt-3 text-sm text-[#9b2638]">
                  We could not send your message right now. Please try again or
                  email{" "}
                  <a
                    href="mailto:rashtram.ai@rishihood.edu.in"
                    className="font-semibold underline underline-offset-2"
                  >
                    rashtram.ai@rishihood.edu.in
                  </a>{" "}
                  directly.
                </p>
              )}
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
