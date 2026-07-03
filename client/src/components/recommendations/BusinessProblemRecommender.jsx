"use client";

import { Loader2, Search, ShieldAlert } from "lucide-react";
import { useState } from "react";
import {
  recommendForProblem,
  trackActivity,
} from "@/lib/api";
import { RecommendationSection } from "./RecommendationSection";

const DOCUMENT_TYPES = [
  ["policy", "Policies"],
  ["act", "Acts"],
  ["bill", "Bills"],
  ["gazette", "Gazette, rules and circulars"],
  ["report", "Reports"],
];

export function BusinessProblemRecommender() {
  const [form, setForm] = useState({
    problem: "",
    industry: "",
    states: "",
    companySize: "",
    topic: "",
    documentTypes: ["policy", "act", "gazette"],
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    if (form.problem.trim().length < 12) {
      setError("Describe the problem in at least 12 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await recommendForProblem({
        ...form,
        states: form.states
          .split(",")
          .map((state) => state.trim())
          .filter(Boolean),
        limit: 20,
      });
      setResult(response);
      trackActivity({
        event_type: "business_problem_searched",
        entity_type: "recommendation_query",
        page_path: "/app/recommend",
        search_query: form.problem,
        filters_json: {
          industry: form.industry,
          states: form.states,
          companySize: form.companySize,
          topic: form.topic,
          documentTypes: form.documentTypes,
        },
      });
    } catch (requestError) {
      setError(requestError.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <section className="surface-card overflow-hidden">
        <div className="bg-[#8f1d2c] p-6 text-white sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
            Business and compliance research
          </p>
          <h1 className="mt-2 max-w-3xl font-serif text-3xl sm:text-4xl">
            Find policies and laws relevant to your business problem
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
            Search verified, research-ready catalogue records using your
            industry, jurisdictions, and policy question.
          </p>
        </div>
        <form onSubmit={submit} className="grid gap-4 p-5 sm:p-7">
          <label>
            <span className="text-xs font-semibold text-[#514d46]">
              Business or policy problem
            </span>
            <textarea
              required
              value={form.problem}
              onChange={(event) => update("problem", event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Describe the decision, regulatory obligation, or policy issue you need to research."
              className="mt-2 w-full resize-y rounded-xl border border-[#8f1d2c]/12 bg-white px-3 py-3 text-sm outline-none focus:border-[#8f1d2c]/35"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="text-xs font-semibold text-[#514d46]">
                Industry
              </span>
              <input
                value={form.industry}
                onChange={(event) => update("industry", event.target.value)}
                placeholder="e.g. logistics, healthcare, fintech"
                className="mt-2 h-11 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-3 text-sm outline-none focus:border-[#8f1d2c]/35"
              />
            </label>
            <label>
              <span className="text-xs font-semibold text-[#514d46]">
                States or jurisdictions
              </span>
              <input
                value={form.states}
                onChange={(event) => update("states", event.target.value)}
                placeholder="West Bengal, Odisha"
                className="mt-2 h-11 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-3 text-sm outline-none focus:border-[#8f1d2c]/35"
              />
            </label>
            <label>
              <span className="text-xs font-semibold text-[#514d46]">
                Company size
              </span>
              <select
                value={form.companySize}
                onChange={(event) => update("companySize", event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-3 text-sm outline-none"
              >
                <option value="">Not specified</option>
                <option value="micro">Micro</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[#514d46]">
                Topic
              </span>
              <input
                value={form.topic}
                onChange={(event) => update("topic", event.target.value)}
                placeholder="licensing, labour, taxation, environment"
                className="mt-2 h-11 w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-3 text-sm outline-none focus:border-[#8f1d2c]/35"
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-xs font-semibold text-[#514d46]">
              Document types
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DOCUMENT_TYPES.map(([value, label]) => {
                const checked = form.documentTypes.includes(value);
                return (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-full px-3 py-2 text-xs ${
                      checked
                        ? "bg-[#8f1d2c] text-white"
                        : "bg-[#eee7dd] text-[#625d55]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        update(
                          "documentTypes",
                          checked
                            ? form.documentTypes.filter((type) => type !== value)
                            : [...form.documentTypes, value],
                        )
                      }
                      className="sr-only"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-[#9a2637]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !form.documentTypes.length}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#8f1d2c] px-5 py-3 text-xs font-semibold text-white disabled:opacity-45"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Finding grounded records…" : "Find relevant documents"}
          </button>
        </form>
      </section>

      {result && (
        <>
          <RecommendationSection
            title="Documents relevant to this problem"
            eyebrow="Real catalogue matches"
            recommendations={result.recommendations || []}
            pagePath="/app/recommend"
            emptyMessage="No research-ready catalogue records matched strongly enough. Broaden the topic, states, or document types."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="surface-card p-5 sm:p-6">
              <h2 className="font-serif text-2xl text-[#8f1d2c]">
                Compliance themes
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(result.complianceThemes || []).map((theme) => (
                  <span
                    key={theme}
                    className="rounded-full bg-[#eee0dc] px-3 py-2 text-xs text-[#625d55]"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </section>
            <section className="surface-card p-5 sm:p-6">
              <h2 className="font-serif text-2xl text-[#8f1d2c]">
                Suggested next questions
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#625d55]">
                {(result.suggestedQuestions || []).map((question) => (
                  <li key={question}>• {question}</li>
                ))}
              </ul>
            </section>
          </div>
          <p className="flex items-center gap-2 rounded-xl bg-[#eee0dc] px-4 py-3 text-xs text-[#70434a]">
            <ShieldAlert className="h-4 w-4" />
            {result.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
