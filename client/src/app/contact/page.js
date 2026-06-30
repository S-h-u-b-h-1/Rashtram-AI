"use client";

import { useState } from "react";
import { submitContactRequest } from "@/lib/api";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  organization: "",
  email: "",
  phone: "",
  message: "",
};

export default function ContactPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState({ loading: false, message: "", error: "" });

  const update = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, message: "", error: "" });
    try {
      const result = await submitContactRequest(form);
      setForm(EMPTY_FORM);
      setStatus({
        loading: false,
        message: `Message received. Reference ${result.requestId}.`,
        error: "",
      });
    } catch (error) {
      setStatus({ loading: false, message: "", error: error.message });
    }
  };

  const fieldClass =
    "mt-2 h-12 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-4 text-sm text-[#29312d] outline-none focus:border-[#a85a52] focus:ring-4 focus:ring-[#a85a52]/10";

  return (
    <main className="min-h-screen bg-[#eee8df] px-5 py-16 sm:py-24">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-[#8f1d2c]/9 bg-[#f8f4ed] p-6 shadow-sm sm:p-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
          Contact Rashtram AI
        </p>
        <h1 className="mt-3 font-serif text-4xl text-[#8f1d2c]">
          Tell us what you are researching
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#706a61]">
          Send a product question, data-source issue, or research workflow
          request. Your message is stored securely for review.
        </p>

        <form onSubmit={submit} className="mt-8 grid gap-5 sm:grid-cols-2">
          {[
            ["firstName", "First name", true],
            ["lastName", "Last name", false],
            ["organization", "Organization", false],
            ["email", "Email", true],
            ["phone", "Phone", false],
          ].map(([name, label, required]) => (
            <label
              key={name}
              className={name === "organization" ? "sm:col-span-2" : ""}
            >
              <span className="text-xs font-semibold text-[#514d46]">{label}</span>
              <input
                name={name}
                type={name === "email" ? "email" : name === "phone" ? "tel" : "text"}
                required={required}
                value={form[name]}
                onChange={update}
                className={fieldClass}
              />
            </label>
          ))}
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold text-[#514d46]">Message</span>
            <textarea
              name="message"
              required
              rows={6}
              value={form.message}
              onChange={update}
              className={`${fieldClass} h-auto py-3`}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={status.loading}
              className="h-12 w-full rounded-xl bg-[#8f1d2c] px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {status.loading ? "Sending…" : "Send message"}
            </button>
            {status.message && (
              <p className="mt-3 text-sm text-[#315a49]">{status.message}</p>
            )}
            {status.error && (
              <p className="mt-3 text-sm text-[#9b2638]">{status.error}</p>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
