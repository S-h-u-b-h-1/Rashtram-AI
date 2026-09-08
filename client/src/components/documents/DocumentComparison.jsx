"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Download,
  GitCompareArrows,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDocumentComparison,
  regenerateDocumentComparison,
  getDocumentComparison,
  getDocumentReadiness,
  prepareDocumentForComparison,
  recommendDocumentsForComparison,
  downloadComparisonPdf,
  trackActivity,
} from "@/lib/api";
import { useComparison } from "@/context/ComparisonContext";
import { comparisonActionState } from "@/lib/comparison-regeneration.mjs";
import { ComparisonAnalysis } from "./ComparisonAnalysis";
import { comparisonStatus } from "@/lib/comparison-presentation.mjs";
import { RecommendationSection } from "@/components/recommendations/RecommendationSection";

export function DocumentComparison() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    documents: selectedDocuments,
    clear: clearComparisonSelection,
  } = useComparison();
  const ids = useMemo(
    () =>
      [
        ...new Set(
          String(searchParams.get("ids") || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ].slice(0, 5),
    [searchParams],
  );
  const comparisonId = searchParams.get("comparison");
  const [mode, setMode] = useState("full");
  const [language, setLanguage] = useState("auto");
  const [userQuestion, setUserQuestion] = useState("");
  const [comparison, setComparison] = useState(null);
  const [selectionRecommendations, setSelectionRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [selectionReadiness, setSelectionReadiness] = useState({});
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [loading, setLoading] = useState(Boolean(comparisonId));
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const initialRequest = useRef("");
  const regenerationInFlight = useRef(false);

  const readinessKey = ids.join(",");
  const selectionReadinessList = useMemo(
    () => ids.map((id) => selectionReadiness[id]).filter(Boolean),
    [ids, selectionReadiness],
  );
  const blockingReadiness = selectionReadinessList.find(
    (readiness) => !readiness.comparisonReady,
  );
  const selectionNotReadyMessage = blockingReadiness
    ? `Document ${blockingReadiness.documentId} is not comparison-ready: ${
        blockingReadiness.reason ||
        blockingReadiness.readinessReason ||
        "retrieval is unavailable"
      }.`
    : "";
  const readinessComplete =
    !ids.length || selectionReadinessList.length === ids.length;
  const canRunComparison =
    ids.length >= 2 &&
    !loading &&
    !regenerating &&
    !readinessLoading &&
    readinessComplete &&
    !blockingReadiness;
  const comparisonAction = comparisonActionState({
    hasComparison: Boolean(comparison),
    loading,
    regenerating,
    readinessLoading,
    ready: canRunComparison,
  });

  const runComparison = async () => {
    if (
      ids.length < 2 || loading || regenerating || readinessLoading ||
      regenerationInFlight.current
    ) return;
    if (!readinessComplete) {
      setError("Checking selected documents before comparison.");
      return;
    }
    if (blockingReadiness) {
      setError(selectionNotReadyMessage);
      return;
    }
    const regeneratingExisting = Boolean(comparison?.id);
    if (regeneratingExisting) {
      regenerationInFlight.current = true;
      setRegenerating(true);
    } else {
      clearComparisonSelection();
      setLoading(true);
    }
    setError("");
    try {
      const payload = {
        documentIds: ids,
        comparisonMode: mode,
        language,
        userQuestion,
      };
      const response = regeneratingExisting
        ? await regenerateDocumentComparison(comparison.id, payload)
        : await createDocumentComparison(payload);
      setComparison(response.comparison);
      if (!regeneratingExisting) {
        trackActivity({
          event_type: "comparison_created",
          entity_type: "document_comparison",
          entity_id: response.comparison.id,
          page_path: "/app/compare",
          metadata_json: {
            comparisonMode: mode,
            documentCount: ids.length,
            documentIds: ids,
          },
        });
        ids.forEach((documentId) => {
          trackActivity({
            event_type: "documents_compared",
            entity_type: "document",
            entity_id: documentId,
            document_id: documentId,
            page_path: "/app/compare",
            metadata_json: {
              comparisonId: response.comparison.id,
              comparisonMode: mode,
            },
          });
        });
      }
      router.replace(
        `/app/compare?comparison=${response.comparison.id}&ids=${ids.join(",")}`,
        { scroll: false },
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (regeneratingExisting) {
        regenerationInFlight.current = false;
        setRegenerating(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!comparisonId) return;
    let active = true;
    setLoading(true);
    getDocumentComparison(comparisonId)
      .then((response) => {
        if (active) {
          setComparison(response.comparison);
          setMode(response.comparison.mode);
          setLanguage(response.comparison.language);
          setUserQuestion(response.comparison.userQuestion || "");
          if (!ids.length && response.comparison.documentIds?.length) {
            router.replace(
              `/app/compare?comparison=${response.comparison.id}&ids=${response.comparison.documentIds.join(",")}`,
              { scroll: false },
            );
          }
        }
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [comparisonId, ids.length, router]);

  useEffect(() => {
    if (!ids.length) {
      setSelectionReadiness({});
      setReadinessLoading(false);
      return;
    }
    let active = true;
    setReadinessLoading(true);
    setError("");
    Promise.all(ids.map(async (id) => {
      try {
        const readiness = await getDocumentReadiness(id);
        if (readiness.comparisonReady || !readiness.canPrepare) {
          return [id, readiness];
        }
        const prepared = await prepareDocumentForComparison(id);
        return [id, prepared.readiness || await getDocumentReadiness(id)];
      } catch (requestError) {
        return [id, {
          documentId: id,
          comparisonReady: false,
          reason: requestError.message || "Could not prepare this document for comparison.",
        }];
      }
    }))
      .then((entries) => {
        if (!active) return;
        setSelectionReadiness(Object.fromEntries(entries));
      })
      .finally(() => {
        if (active) setReadinessLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ids, readinessKey]);

  useEffect(() => {
    if (!ids.length) {
      setSelectionRecommendations([]);
      return;
    }
    let active = true;
    setRecommendationsLoading(true);
    recommendDocumentsForComparison({
      selectedDocumentIds: ids,
      preferredTypes: ["bill", "state_bill", "act", "policy", "gazette"],
      limit: 10,
    })
      .then((response) => {
        if (active) setSelectionRecommendations(response.recommendations || []);
      })
      .catch(() => {
        if (active) setSelectionRecommendations([]);
      })
      .finally(() => {
        if (active) setRecommendationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ids]);

  useEffect(() => {
    const key = ids.join(",");
    if (
      comparisonId ||
      ids.length < 2 ||
      readinessLoading ||
      !readinessComplete ||
      initialRequest.current === key
    ) {
      return;
    }
    initialRequest.current = key;
    if (blockingReadiness) {
      setError(selectionNotReadyMessage);
      return;
    }
    runComparison();
  // The initial comparison is intentionally tied to the URL selection only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    blockingReadiness,
    comparisonId,
    ids,
    readinessComplete,
    readinessLoading,
    selectionNotReadyMessage,
  ]);

  const result = comparison?.result;
  const status = comparisonStatus(result);
  const chatDocumentIds = useMemo(() => {
    if (result?.documents?.length) {
      return result.documents
        .map((document) => String(document.id))
        .filter(Boolean);
    }
    if (ids.length) return ids;
    return selectedDocuments
      .map((document) => String(document.id))
      .filter(Boolean);
  }, [ids, result?.documents, selectedDocuments]);
  const chatIds = chatDocumentIds.join(",");
  const chatHref = `/app/multi-document-chat?ids=${chatIds}${
    comparison?.id ? `&comparison=${comparison.id}` : ""
  }`;
  const hasEmbeddedChat = Boolean(result && chatDocumentIds.length >= 2);
  const focusEmbeddedChat = () => {
    router.push(chatHref);
  };
  const queueSuggestedQuestion = (question) => {
    router.push(`${chatHref}&q=${encodeURIComponent(question)}`);
  };
  const createReport = async () => {
    if (reportLoading || !comparison?.id) return;
    setReportLoading(true);
    setReportError("");
    try {
      await downloadComparisonPdf(comparison.id);
    } catch (requestError) { setReportError(requestError.message); }
    finally { setReportLoading(false); }
  };

  if (!comparison && ids.length === 0 && !comparisonId) {
    return (
      <section className="surface-card grid min-h-[500px] place-items-center p-8 text-center">
        <div>
          <GitCompareArrows className="mx-auto h-10 w-10 text-[#8f1d2c]" />
          <h2 className="mt-4 font-serif text-2xl text-[#8f1d2c]">
            Select at least two research-ready documents
          </h2>
          <p className="mt-2 text-sm text-[#706a61]">
            Add documents from any catalogue, search result, or research page.
          </p>
          <Link
            href="/app/library"
            className="mt-5 inline-flex rounded-xl bg-[#8f1d2c] px-4 py-2.5 text-xs font-semibold text-white"
          >
            Browse documents
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-5 pb-5 [overflow-wrap:anywhere]">
      <section className="surface-card overflow-hidden">
        <div className={`${result ? "bg-white text-[#29312d]" : "bg-[#8f1d2c] text-white"} p-5 sm:p-7`}>
          <p className={`text-xs font-bold uppercase tracking-[0.2em] ${result ? "text-[#874047]" : "text-white/80"}`}>
            Grounded document comparison
          </p>
          <h2 className={`mt-2 font-serif ${result ? "text-2xl text-[#8f1d2c]" : "text-3xl"}`}>
            {result?.comparisonSchemaVersion === 'comparison-findings-v2' ? 'Compare Documents' : comparison?.title ||
              (readinessLoading
                ? "Checking selected documents"
                : "Preparing comparison")}
          </h2>
          {result && result.comparisonSchemaVersion !== 'comparison-findings-v2' && <p role="status" className="mt-3 text-sm font-semibold text-[#8f1d2c]">{status.label}</p>}
          <div className={`${result ? "mt-4 border-t border-[#8f1d2c]/10 pt-4" : "mt-5"} flex flex-wrap gap-3`}>
            <label className="text-xs">
              <span className="sr-only">Comparison mode</span>
              <select
                value={mode}
                disabled={loading || regenerating}
                onChange={(event) => setMode(event.target.value)}
                className={`h-10 rounded-xl px-3 outline-none ${result ? "border border-[#8f1d2c]/15 bg-[#fffaf0] text-[#514d46]" : "bg-white/10 text-white"}`}
              >
                {["full", "summary", "clause", "impact", "timeline", "compliance"].map(
                  (value) => (
                    <option key={value} value={value} className="text-black">
                      {value[0].toUpperCase() + value.slice(1)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-xs">
              <span className="sr-only">Response language</span>
              <select
                value={language}
                disabled={loading || regenerating}
                onChange={(event) => setLanguage(event.target.value)}
                className={`h-10 rounded-xl px-3 outline-none ${result ? "border border-[#8f1d2c]/15 bg-[#fffaf0] text-[#514d46]" : "bg-white/10 text-white"}`}
              >
                <option value="auto" className="text-black">Auto</option>
                <option value="english" className="text-black">English</option>
                <option value="hindi" className="text-black">हिन्दी</option>
              </select>
            </label>
            {ids.length >= 2 && (
              <button
                type="button"
                disabled={!canRunComparison}
                aria-describedby={!canRunComparison ? "comparison-action-reason" : undefined}
                onClick={runComparison}
                className={`rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50 ${result ? "bg-[#8f1d2c] text-white" : "bg-[#fffaf0] text-[#8f1d2c]"}`}
              >
                {comparisonAction.label}
              </button>
            )}
            {chatIds && (
              hasEmbeddedChat ? (
                <button
                  type="button"
                  onClick={focusEmbeddedChat}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${result ? "border border-[#8f1d2c]/15 text-[#8f1d2c] hover:bg-[#f4eae4]" : "bg-white/10 hover:bg-white/15"}`}
                >
                  <MessageSquareText className="h-4 w-4" />
                  Ask follow-up questions
                </button>
              ) : (
                <Link
                  href={chatHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold transition hover:bg-white/15"
                >
                  <MessageSquareText className="h-4 w-4" />
                  Ask follow-up questions
                </Link>
              )
            )}
          </div>
          {!canRunComparison && <p id="comparison-action-reason" className="mt-3 text-xs">{loading || regenerating ? "Wait for the current comparison to finish." : readinessLoading ? "Checking source readiness…" : selectionNotReadyMessage || "Select at least two ready sources."}</p>}
          {!result && <label className="mt-4 block max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80">
              Optional focused question
            </span>
            <textarea
              value={userQuestion}
              disabled={loading || regenerating}
              onChange={(event) => setUserQuestion(event.target.value)}
              maxLength={1500}
              rows={2}
              placeholder="For example: How do their compliance obligations and implementation timelines differ?"
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/30"
            />
          </label>}
        </div>
        {regenerating && (
          <p
            role="status"
            aria-live="polite"
            className="bg-[#f6eadf] px-5 py-3 text-sm text-[#754e14]"
          >
            Regenerating comparison… Your current comparison will remain visible until the new version is verified.
          </p>
        )}
        {error && (
          <p role="alert" className="bg-[#f4dfdc] px-5 py-3 text-sm text-[#85434a]">
            {error}
          </p>
        )}
        {!error && selectionNotReadyMessage && (
          <p role="alert" className="bg-[#f4dfdc] px-5 py-3 text-sm text-[#85434a]">
            {selectionNotReadyMessage}
          </p>
        )}

      </section>

      {!comparison && ids.length === 1 && (
        <section className="surface-card p-5 sm:p-6">
          <h3 className="font-serif text-2xl text-[#8f1d2c]">
            Select one more document to compare
          </h3>
          <p className="mt-2 text-sm text-[#706a61]">
            Recommendations below use the selected document’s ministry,
            jurisdiction, subject, graph relationships, and indexed text.
          </p>
        </section>
      )}

      {!comparison && ids.length > 0 && (
        <RecommendationSection
          title="Recommended documents to compare"
          eyebrow={
            recommendationsLoading
              ? "Finding comparison matches…"
              : "Selection-aware recommendations"
          }
          recommendations={selectionRecommendations}
          emptyMessage={
            recommendationsLoading
              ? "Analysing the selected documents…"
              : "No closely related comparison-ready documents are available yet."
          }
          pagePath="/app/compare"
        />
      )}

      {loading && !result ? (
        <div className="surface-card grid min-h-[420px] place-items-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#8f1d2c]" />
            <p className="mt-3 text-sm text-[#706a61]">
              Analyzing structure and comparing evidence…
            </p>
          </div>
        </div>
      ) : result ? (
        <>
          <section className="surface-card p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-serif text-2xl text-[#8f1d2c]">Documents compared</h3>
              <button type="button" onClick={createReport} disabled={reportLoading || !comparison?.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#8f1d2c]/15 bg-white px-4 py-2.5 text-xs font-semibold text-[#8f1d2c] disabled:opacity-45">
                {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {reportLoading ? "Building comparison PDF…" : "Export PDF"}
              </button>
            </div>
            {reportError && <p role="alert" className="mt-3 text-xs text-[#9a2637]">{reportError}</p>}
            {result.comparisonSchemaVersion === 'comparison-findings-v2' && result.relationship && result.relationship !== 'NO_VERIFIED_RELATIONSHIP' && <p className="mt-3 text-sm text-[#706a61]">
              Relationship: {(result.relationship || 'NO_VERIFIED_RELATIONSHIP').replaceAll('_', ' ').toLowerCase()}
            </p>}
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {(result.documents || []).map((document, index) => (
                <article
                  key={document.id}
                  className="rounded-xl border border-[#8f1d2c]/8 bg-[#f7f2eb] p-4"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8f1d2c]">D{index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-[#29312d]">{document.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.1em] text-[#706a61]">
                    {[document.type, document.ministry || document.authority,
                      document.state || document.jurisdiction,
                      document.year]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <ComparisonAnalysis result={result} />

          {(result.suggestedQuestions || []).length > 0 && (
            <section className="surface-card p-5 sm:p-6">
              <h3 className="font-serif text-xl text-[#8f1d2c]">
                Suggested follow-up questions
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.suggestedQuestions.map((question) => (
                  <button
                    type="button"
                    key={question}
                    onClick={() => queueSuggestedQuestion(question)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#eee0dc] px-3 py-2 text-left text-xs text-[#514d46] transition hover:bg-[#e5d4cf]"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#8f1d2c]" />
                    {question}
                  </button>
                ))}
              </div>
            </section>
          )}

          {hasEmbeddedChat && (
            <section className="scroll-mt-24">
              <div className="mb-3 rounded-2xl border border-[#8f1d2c]/8 bg-[#fffaf0] p-5 shadow-sm sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#874047]">
                  Comparison chat
                </p>
                <h3 className="mt-1 font-serif text-2xl text-[#8f1d2c]">
                  Ask follow-up questions from this comparison
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#706a61]">
                  Continue with a grounded multi-document chat. Answers stay
                  tied to the documents used in this comparison.
                </p>
              </div>
              <Link href={chatHref} className="inline-flex min-h-11 items-center rounded-xl bg-[#8f1d2c] px-4 text-sm text-white">Continue research with these sources</Link>
            </section>
          )}

          <RecommendationSection
            title="Recommended follow-up documents"
            eyebrow="Continue the research"
            recommendations={
              comparison?.recommendedDocuments ||
              result.recommendedDocuments ||
              []
            }
            pagePath="/app/compare"
          />
        </>
      ) : null}
    </div>
  );
}
