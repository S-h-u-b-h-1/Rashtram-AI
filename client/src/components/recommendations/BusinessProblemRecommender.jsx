"use client";

import { Bell, Check, Loader2, Search, ShieldAlert } from "lucide-react";
import { useState } from "react";
import {
  researchComplianceForProblem,
  createRegulatoryWatchlist,
  refreshRegulatoryWatchlists,
  trackActivity,
} from "@/lib/api";
import { RecommendationSection } from "./RecommendationSection";

export function BusinessProblemRecommender() {
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchStatus, setWatchStatus] = useState("");

  const watchProblem = async () => {
    if (watching || problem.trim().length < 2) return;
    setWatching(true);
    setWatchStatus("");
    try {
      await createRegulatoryWatchlist({ watchType: "topic", watchValue: problem });
      const refresh = await refreshRegulatoryWatchlists();
      setWatchStatus(`Watchlist saved. ${refresh.created || 0} verified alert${refresh.created === 1 ? "" : "s"} found.`);
    } catch (requestError) {
      setWatchStatus(requestError.message);
    } finally {
      setWatching(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    if (problem.trim().length < 12) {
      setError("Describe the problem in at least 12 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await researchComplianceForProblem({
        problem,
        limit: 20,
      });
      setResult(response);
      trackActivity({
        event_type: "business_problem_searched",
        entity_type: "recommendation_query",
        page_path: "/app/recommend",
        search_query: problem,
        filters_json: { mode: "problem_only" },
      });
    } catch (requestError) {
      setError(requestError.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-0 space-y-5 pb-5">
      <section className="surface-card overflow-hidden">
        <div className="bg-[#8f1d2c] p-6 text-white sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
            Business and compliance research
          </p>
          <h1 className="mt-2 max-w-3xl font-serif text-3xl sm:text-4xl">
            Find policies and laws relevant to your business problem
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
            Describe the situation in your own words. Rashtram AI will infer
            the relevant sectors, jurisdictions, themes, and document types.
          </p>
        </div>
        <form onSubmit={submit} className="grid gap-4 p-5 sm:p-7">
          <label>
            <span className="text-xs font-semibold text-[#514d46]">
              Business or policy problem
            </span>
            <textarea
              required
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Describe the decision, regulatory obligation, or policy issue you need to research."
              className="mt-2 w-full resize-y rounded-xl border border-[#8f1d2c]/12 bg-white px-3 py-3 text-sm outline-none focus:border-[#8f1d2c]/35"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-[#9a2637]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
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
            emptyMessage="No research-ready catalogue records matched strongly enough. Add the sector, location, obligation, or affected group to your problem description and try again."
          />
          {result.abstention && (
            <section role="status" className="surface-card border border-[#8f1d2c]/12 p-5 sm:p-6">
              <h2 className="font-serif text-2xl text-[#8f1d2c]">
                Insufficient relevant evidence
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#625d55]">
                {result.abstention}
              </p>
            </section>
          )}
          {(result.preparationCandidates || []).length > 0 && (
            <RecommendationSection
              title="Relevant records that need preparation"
              eyebrow="Catalogue coverage found"
              recommendations={result.preparationCandidates}
              pagePath="/app/recommend"
              emptyMessage=""
            />
          )}
          {(result.lowerConfidenceRecommendations || []).length > 0 && (
            <RecommendationSection
              title="More possible matches"
              eyebrow="Lower-confidence discovery results"
              recommendations={result.lowerConfidenceRecommendations}
              pagePath="/app/recommend"
              emptyMessage=""
            />
          )}
          {result.primarySourceGap && (
            <p className="rounded-xl border border-[#c1a06f]/35 bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#70434a]">
              {result.primarySourceGap}
            </p>
          )}
          {result.coverageExplanation && (
            <p role="status" className="rounded-xl border border-[#8f1d2c]/12 bg-[#f7f2eb] px-4 py-3 text-xs leading-5 text-[#70434a]">
              {result.coverageExplanation}
            </p>
          )}
          <section className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="font-serif text-2xl text-[#8f1d2c]">Track verified updates</h2>
              <p className="mt-1 text-sm leading-6 text-[#706a61]">
                Save this problem as a private watchlist. Alerts include the source and explain the exact match.
              </p>
              {watchStatus && <p role="status" className="mt-2 text-xs font-semibold text-[#70434a]">{watchStatus}</p>}
            </div>
            <button
              type="button"
              onClick={watchProblem}
              disabled={watching}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#8f1d2c]/20 bg-white px-4 py-3 text-xs font-semibold text-[#8f1d2c] disabled:opacity-45"
            >
              {watching ? <Loader2 className="h-4 w-4 animate-spin" /> : watchStatus.startsWith("Watchlist saved") ? <Check className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {watching ? "Checking sources…" : "Watch this problem"}
            </button>
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="surface-card p-5 sm:p-6">
              <h2 className="font-serif text-2xl text-[#8f1d2c]">
                {result.sourceSupportedThemes?.length
                  ? "Source-supported themes"
                  : "Inferred themes"}
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
          {result.evidenceStatus === "sufficient_relevant_evidence" ? (
            <section className="surface-card p-5 sm:p-6">
              <h2 className="font-serif text-2xl text-[#8f1d2c]">What the sources say</h2>
              <p className="mt-2 text-sm leading-6 text-[#706a61]">
                These possible requirements come from relevant cited passages. Confirm that they apply to your exact business.
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#874047]">Possible obligations</h3>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-[#514d46]">
                    {(result.evidenceBackedObligations || []).map((item) => (
                      <li key={`${item.documentId}-${item.citations?.[0]}`} className="rounded-xl bg-[#fffaf0] p-3">
                        {item.finding} <span className="text-xs font-semibold text-[#8f1d2c]">[{item.citations?.join(", ")}]</span>
                      </li>
                    ))}
                    {!result.evidenceBackedObligations?.length && <li>No explicit obligation passage was found.</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#874047]">What still needs checking</h3>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-[#514d46]">
                    {(result.missingEvidence || []).map((item) => <li key={item}>• {item}</li>)}
                    {(result.questionsRequiringProfessionalVerification || []).map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              </div>
            </section>
          ) : (
            <section className="surface-card p-5 sm:p-6">
              <h2 className="font-serif text-2xl text-[#8f1d2c]">What the sources say</h2>
              <p className="mt-2 text-sm leading-6 text-[#625d55]">
                Insufficient relevant evidence. No obligation was generated from metadata or lower-confidence matches.
              </p>
            </section>
          )}
          <p className="flex items-center gap-2 rounded-xl bg-[#eee0dc] px-4 py-3 text-xs text-[#70434a]">
            <ShieldAlert className="h-4 w-4" />
            {result.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
