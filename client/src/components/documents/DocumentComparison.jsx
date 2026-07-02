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
} from "@/lib/api";
import { useComparison } from "@/context/ComparisonContext";

const SECTION_CONFIG = [
  ["similarities", "Similarities"],
  ["differences", "Differences"],
  ["keyClauses", "Key clauses"],
  ["stakeholders", "Stakeholders"],
  ["timeline", "Timeline"],
  ["authorityDifferences", "Authority differences"],
  ["impactAssessment", "Impact assessment"],
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
  const [mode, setMode] = useState("comprehensive");
  const [language, setLanguage] = useState("English");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(Boolean(comparisonId));
  const [error, setError] = useState("");
  const initialRequest = useRef("");

  const runComparison = async () => {
    if (ids.length < 2 || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await createDocumentComparison({
        documentIds: ids,
        mode,
        language,
      });
      setComparison(response.comparison);
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
        }
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [comparisonId]);

  useEffect(() => {
    const key = ids.join(",");
    if (comparisonId || ids.length < 2 || initialRequest.current === key) return;
    initialRequest.current = key;
    runComparison();
  // The initial comparison is intentionally tied to the URL selection only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonId, ids]);

  const result = comparison?.result;
  const citationMap = useMemo(
    () =>
      new Map(
        (result?.citations || []).map((citation) => [citation.id, citation]),
      ),
    [result?.citations],
  );
  const chatIds = (result?.documents || selectedDocuments)
    .map((document) => document.id)
    .join(",");
  const chatHref = `/app/multi-document-chat?ids=${chatIds}${
    comparison?.id ? `&comparison=${comparison.id}` : ""
  }`;

  if (!comparison && ids.length < 2 && !comparisonId) {
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
            {comparison?.title || "Preparing comparison"}
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
                {["comprehensive", "legal", "policy", "timeline", "stakeholder"].map(
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
                <option className="text-black">English</option>
                <option className="text-black">Hindi</option>
              </select>
            </label>
            {ids.length >= 2 && (
              <button
                type="button"
                disabled={loading}
                onClick={runComparison}
                className="rounded-xl bg-[#fffaf0] px-4 py-2 text-xs font-semibold text-[#8f1d2c] disabled:opacity-50"
              >
                {loading ? "Comparing…" : "Run with these settings"}
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
        </div>
        {error && (
          <p role="alert" className="bg-[#f4dfdc] px-5 py-3 text-sm text-[#85434a]">
            {error}
          </p>
        )}
      </section>

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
              Executive summary
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#514d46]">
              {result.executiveSummary}
            </p>
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
        </>
      ) : null}
    </div>
  );
}
