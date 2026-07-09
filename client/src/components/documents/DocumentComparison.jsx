"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ExternalLink,
  FileText,
  GitCompareArrows,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDocumentComparison,
  getDocumentComparison,
  getDocumentReadiness,
  recommendDocumentsForComparison,
  trackActivity,
} from "@/lib/api";
import { useComparison } from "@/context/ComparisonContext";
import { RecommendationSection } from "@/components/recommendations/RecommendationSection";

const SECTION_CONFIG = [
  ["similarities", "Similarities"],
  ["differences", "Differences"],
  ["keyClauses", "Key clauses"],
  ["stakeholders", "Stakeholders"],
  ["complianceImpact", "Compliance and policy impact"],
  ["timeline", "Timeline"],
  ["authorityDifferences", "Authority differences"],
  ["impactAssessment", "Impact assessment"],
  ["keyFindings", "Key findings"],
];

const itemText = (item) => {
  if (typeof item === "string") return item;
  return [
    item.topic,
    item.date,
    item.name,
    item.clause,
    item.point,
    item.event,
    item.analysis,
    item.impact,
  ]
    .filter(Boolean)
    .join(" — ");
};

function CitationLinks({ ids, citationMap }) {
  if (!Array.isArray(ids) || !ids.length) return null;
  return (
    <span className="ml-2 inline-flex flex-wrap gap-1">
      {ids.map((id) => {
        const citation = citationMap.get(id);
        return (
          <a
            key={id}
            href={citation?.pdfUrl || citation?.sourceUrl || `#source-${id}`}
            target={citation?.pdfUrl || citation?.sourceUrl ? "_blank" : undefined}
            rel="noreferrer"
            title={citation?.snippet}
            className="rounded bg-[#eee0dc] px-1.5 py-0.5 text-[9px] font-bold text-[#8f1d2c]"
          >
            {id}
          </a>
        );
      })}
    </span>
  );
}

export function DocumentComparison() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { documents: selectedDocuments } = useComparison();
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
  const [error, setError] = useState("");
  const initialRequest = useRef("");

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
    !readinessLoading &&
    readinessComplete &&
    !blockingReadiness;

  const runComparison = async () => {
    if (ids.length < 2 || loading || readinessLoading) return;
    if (!readinessComplete) {
      setError("Checking selected documents before comparison.");
      return;
    }
    if (blockingReadiness) {
      setError(selectionNotReadyMessage);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await createDocumentComparison({
        documentIds: ids,
        comparisonMode: mode,
        language,
        userQuestion,
      });
      setComparison(response.comparison);
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
      router.replace(
        `/app/compare?comparison=${response.comparison.id}&ids=${ids.join(",")}`,
        { scroll: false },
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
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
        }
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [comparisonId]);

  useEffect(() => {
    if (!ids.length || comparisonId) {
      setSelectionReadiness({});
      setReadinessLoading(false);
      return;
    }
    let active = true;
    setReadinessLoading(true);
    setError("");
    Promise.all(
      ids.map((id) =>
        getDocumentReadiness(id)
          .then((readiness) => [id, readiness])
          .catch((requestError) => [
            id,
            {
              documentId: id,
              comparisonReady: false,
              reason:
                requestError.message ||
                "Could not verify this document's readiness.",
            },
          ]),
      ),
    )
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
  }, [comparisonId, readinessKey]);

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
  const citationMap = useMemo(
    () =>
      new Map(
        (result?.citations || []).map((citation) => [citation.id, citation]),
      ),
    [result?.citations],
  );
  const chatIds = result?.documents?.length
    ? result.documents.map((document) => document.id).join(",")
    : ids.length
      ? ids.join(",")
      : selectedDocuments.map((document) => document.id).join(",");
  const chatHref = `/app/multi-document-chat?ids=${chatIds}${
    comparison?.id ? `&comparison=${comparison.id}` : ""
  }`;

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
            href="/app?view=bills"
            className="mt-5 inline-flex rounded-xl bg-[#8f1d2c] px-4 py-2.5 text-xs font-semibold text-white"
          >
            Browse documents
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      <section className="surface-card overflow-hidden">
        <div className="bg-[#8f1d2c] p-5 text-white sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
            Grounded document comparison
          </p>
          <h2 className="mt-2 font-serif text-3xl">
            {comparison?.title ||
              (readinessLoading
                ? "Checking selected documents"
                : "Preparing comparison")}
          </h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <label className="text-xs">
              <span className="sr-only">Comparison mode</span>
              <select
                value={mode}
                disabled={loading}
                onChange={(event) => setMode(event.target.value)}
                className="h-10 rounded-xl bg-white/10 px-3 text-white outline-none"
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
                disabled={loading}
                onChange={(event) => setLanguage(event.target.value)}
                className="h-10 rounded-xl bg-white/10 px-3 text-white outline-none"
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
                onClick={runComparison}
                className="rounded-xl bg-[#fffaf0] px-4 py-2 text-xs font-semibold text-[#8f1d2c] disabled:opacity-50"
              >
                {loading
                  ? "Comparing…"
                  : readinessLoading
                    ? "Checking readiness…"
                    : "Run with these settings"}
              </button>
            )}
            {chatIds && (
              <Link
                href={chatHref}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold"
              >
                <MessageSquareText className="h-4 w-4" />
                Ask follow-up questions
              </Link>
            )}
          </div>
          <label className="mt-4 block max-w-3xl">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
              Optional focused question
            </span>
            <textarea
              value={userQuestion}
              disabled={loading}
              onChange={(event) => setUserQuestion(event.target.value)}
              maxLength={1500}
              rows={2}
              placeholder="For example: How do their compliance obligations and implementation timelines differ?"
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/30"
            />
          </label>
        </div>
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

      {ids.length > 0 && (
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
              Retrieving and comparing source passages…
            </p>
          </div>
        </div>
      ) : result ? (
        <>
          <section className="surface-card p-5 sm:p-6">
            <h3 className="font-serif text-2xl text-[#8f1d2c]">
              Documents compared
            </h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {(result.documents || []).map((document) => (
                <article
                  key={document.id}
                  className="rounded-xl border border-[#8f1d2c]/8 bg-[#f7f2eb] p-4"
                >
                  <p className="text-sm font-semibold text-[#29312d]">
                    {document.title}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[#81796e]">
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

          <section className="surface-card p-5 sm:p-6">
            <h3 className="font-serif text-2xl text-[#8f1d2c]">
              Executive summary
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#514d46]">
              {result.executiveSummary}
            </p>
          </section>

          <section className="surface-card p-5 sm:p-6">
            <h3 className="font-serif text-2xl text-[#8f1d2c]">
              Relationship overlap
            </h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {(result.relationshipIntelligence?.relationships || []).map(
                (relationship) => (
                  <article
                    key={relationship.id}
                    className="rounded-xl border border-[#8f1d2c]/8 bg-[#f7f2eb] p-4"
                  >
                    <p className="text-xs font-semibold text-[#29312d]">
                      {relationship.sourceTitle} → {relationship.targetTitle}
                    </p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8f1d2c]">
                      {relationship.label}
                      {relationship.confidence != null
                        ? ` · ${Math.round(relationship.confidence * 100)}% confidence`
                        : ""}
                    </p>
                    {relationship.explanation && (
                      <p className="mt-2 text-xs leading-5 text-[#706a61]">
                        {relationship.explanation}
                      </p>
                    )}
                  </article>
                ),
              )}
            </div>
            {!(result.relationshipIntelligence?.relationships || []).length && (
              <p className="mt-3 text-sm text-[#81796e]">
                No direct verified relationship is stored between these
                documents.
              </p>
            )}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Shared ministries", "sharedMinistries"],
                ["Shared authorities", "sharedAuthorities"],
                ["Shared jurisdictions", "sharedJurisdictions"],
                ["Shared topics", "sharedTopics"],
              ].map(([label, key]) => (
                <div key={key} className="rounded-xl bg-[#fffaf0] p-3">
                  <dt className="text-[9px] uppercase tracking-[0.1em] text-[#81796e]">
                    {label}
                  </dt>
                  <dd className="mt-1 text-xs text-[#514d46]">
                    {result.relationshipIntelligence?.[key]?.join(", ") ||
                      "None identified"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            {SECTION_CONFIG.map(([key, title]) => (
              <section key={key} className="surface-card p-5 sm:p-6">
                <h3 className="font-serif text-xl text-[#8f1d2c]">{title}</h3>
                <ul className="mt-3 space-y-3">
                  {(result[key] || []).map((item, index) => (
                    <li
                      key={`${key}-${index}`}
                      className="rounded-xl bg-[#f7f2eb] p-3 text-sm leading-6 text-[#514d46]"
                    >
                      {itemText(item)}
                      <CitationLinks
                        ids={item?.citations}
                        citationMap={citationMap}
                      />
                    </li>
                  ))}
                  {!result[key]?.length && (
                    <li className="text-sm text-[#81796e]">
                      Not identified in the retrieved text.
                    </li>
                  )}
                </ul>
              </section>
            ))}
          </div>

          <section className="surface-card p-5 sm:p-6">
            <h3 className="font-serif text-xl text-[#8f1d2c]">
              Original source snippets
            </h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {(result.citations || []).map((citation) => (
                <article
                  id={`source-${citation.id}`}
                  key={citation.id}
                  className="rounded-xl border border-[#8f1d2c]/8 bg-[#f7f2eb] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-[#8f1d2c]">
                        {citation.id}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#29312d]">
                        {citation.documentTitle}
                      </p>
                    </div>
                    {(citation.pdfUrl || citation.sourceUrl) && (
                      <a
                        href={citation.pdfUrl || citation.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open source ${citation.id}`}
                      >
                        <ExternalLink className="h-4 w-4 text-[#8f1d2c]" />
                      </a>
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-6 text-[#706a61]">
                    {citation.snippet}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {(result.suggestedQuestions || []).length > 0 && (
            <section className="surface-card p-5 sm:p-6">
              <h3 className="font-serif text-xl text-[#8f1d2c]">
                Suggested follow-up questions
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.suggestedQuestions.map((question) => (
                  <Link
                    key={question}
                    href={chatHref}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#eee0dc] px-3 py-2 text-xs text-[#514d46]"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#8f1d2c]" />
                    {question}
                  </Link>
                ))}
              </div>
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
