"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookmarkPlus,
  ExternalLink,
  FileDown,
  GitCompareArrows,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchDocuments,
  saveSearch,
  trackActivity,
  trackSearchActivity,
} from "@/lib/api";
import {
  isResearchReady,
  isSourceOnlyResearchDocument,
  shouldShowPdfAction,
} from "@/lib/document-readiness";
import { formatDate, humanize } from "@/lib/document-links";
import { DocumentFilters } from "./DocumentFilters";
import {
  canPrepareForResearch,
  comparisonDisabledReason,
  useComparison,
} from "@/context/ComparisonContext";

const EMPTY_FILTERS = {
  type: "",
  status: "",
  year: "",
  ministry: "",
  authority: "",
  category: "",
  jurisdiction: "",
  source: "",
  sourceType: "",
  language: "",
  state: "",
  hasPdf: "",
  researchReady: "",
  comparisonReady: "",
  publicationFrom: "",
  publicationTo: "",
};

const READINESS_LABELS = {
  research_ready: "Ready to research",
  search_ready: "Source available",
  comparison_ready: "Ready to research",
  pdf_available: "PDF available",
  processing_failed: "Could not prepare this source",
  source_only: "Source available",
  missing_pdf: "Source available",
  processing_pending: "Preparing source…",
  processing_failed_retriable: "Could not prepare this source",
  source_extractable_not_processed: "Source available",
  processing_failed_permanent: "Could not prepare this source",
  ocr_required: "Source needs preparation",
  unsupported_file_type: "Unsupported file",
  invalid_or_quarantined: "Could not prepare this source",
};

const documentDateLabel = (document) => {
  const legislativeDate =
    document.publicationDate ||
    document.introducedDate ||
    document.passedDate ||
    document.enactedDate ||
    document.effectiveDate ||
    document.commencementDate;
  if (legislativeDate) return formatDate(legislativeDate);
  if (document.year) return String(document.year);
  if (document.firstSeenAt) {
    return `Catalogued ${formatDate(document.firstSeenAt)}`;
  }
  if (document.updatedAt) {
    return `Updated ${formatDate(document.updatedAt)}`;
  }
  return "Date unavailable";
};

export function DocumentExplorer({
  type,
  scope,
  source,
  jurisdictionLevel,
  title,
  description,
  eyebrow = "Document library",
  filterKeys,
  filterLabels,
  dataNote,
  initialQuery = "",
  initialFilters = {},
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, researchReady: "true", ...initialFilters });
  const [documents, setDocuments] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [sortBy, setSortBy] = useState(initialQuery ? "relevance" : "publicationDate");
  const [sortDirection, setSortDirection] = useState("desc");
  const requestSequence = useRef(0);
  const {
    addDocument,
    prepareAndAddDocument,
    removeDocument,
    isSelected,
  } = useComparison();
  const [preparingCompareId, setPreparingCompareId] = useState(null);

  const requestFilters = useMemo(
    () => ({
      ...filters,
      type: type || filters.type,
      scope: scope || filters.scope,
      source: source || filters.source,
      jurisdictionLevel: jurisdictionLevel || filters.jurisdictionLevel,
    }),
    [filters, jurisdictionLevel, scope, source, type],
  );

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetchDocuments({
          ...requestFilters,
          search: query.trim(),
          semantic: query.trim().length >= 3,
          page,
          limit: 20,
          sortBy,
          sortDirection,
          signal: controller.signal,
        });
        // A user can change the query/filter several times before the server
        // replies. Only the latest request is allowed to update the list.
        if (sequence !== requestSequence.current) return;
        setDocuments(response.documents || []);
        setSuggestions(response.suggestions || []);
        setPagination(response.pagination || {});
        setFilterOptions(response.filters || {});
      } catch (requestError) {
        if (
          controller.signal.aborted ||
          requestError?.name === "AbortError" ||
          sequence !== requestSequence.current
        ) {
          return;
        }
        setError(requestError.message || "Unable to load documents.");
        setDocuments([]);
        setSuggestions([]);
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, query, requestFilters, sortBy, sortDirection, revision]);

  useEffect(() => {
    setPage(1);
  }, [query, requestFilters]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    trackSearchActivity({
      event_type: "search_performed",
      entity_type: type || "document",
      page_path: "/app",
      search_query: query.trim(),
      filters_json: requestFilters,
      metadata_json: { documentType: type || "all" },
    });
  }, [query, requestFilters, type]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="overflow-hidden">
      <div className="border-b border-[#8f1d2c]/10 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="mt-2 font-serif text-3xl text-[#8f1d2c]">
              {title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#706a61]">
              {description}
            </p>
          </div>
          <div className="text-sm text-[#706a61]">
            <p>
              {Number(pagination.total || 0).toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-[#706a61]">
              Records found
            </p>
          </div>
        </div>
        <div className="mt-5">
          <DocumentFilters
            query={query}
            filters={filters}
            options={filterOptions}
            showType={!type && !scope}
            filterKeys={filterKeys}
            filterLabels={filterLabels}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onQueryChange={(value) => { setQuery(value); setSortBy(value.trim() ? "relevance" : "publicationDate"); setPage(1); }}
            onFilterChange={updateFilter}
            onSortChange={setSortBy}
            onSortDirectionChange={setSortDirection}
            onClear={() => setFilters(EMPTY_FILTERS)}
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-[#706a61]">{filters.researchReady === "true" ? "Showing sources ready for cited research." : "Showing the full collection, including sources not yet prepared for chat."} <button type="button" className="min-h-11 px-2 font-semibold text-[#8f1d2c] underline" onClick={() => updateFilter("researchReady", filters.researchReady === "true" ? "" : "true")}>{filters.researchReady === "true" ? "Show all sources" : "Show ready sources"}</button></p>
        {dataNote && (
          <p className="mt-3 rounded-xl border border-[#8f1d2c]/8 bg-white/55 px-3 py-2 text-[11px] leading-5 text-[#706a61]">
            {dataNote}
          </p>
        )}
        <button
          type="button"
          onClick={() =>
            saveSearch({
              name: query.trim() ? `Documents: ${query.trim()}` : title,
              query: query.trim(),
              filters: requestFilters,
            })
          }
          className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#874047]"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          Save this search
        </button>
      </div>

      <div>
        {loading ? (
          <div className="grid min-h-[300px] place-items-center" role="status">
            <span className="flex items-center gap-3 text-sm text-[#706a61]"><Loader2 className="h-5 w-5 animate-spin text-[#8f1d2c]" />Finding documents…</span>
          </div>
        ) : error ? (
          <div className="grid min-h-[300px] place-items-center p-8 text-center">
            <div><p role="alert" className="text-sm text-[#85434a]">{error}</p><button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-4 min-h-11 rounded-lg border border-[#8f1d2c]/15 px-4 text-sm text-[#8f1d2c]">Try again</button></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="min-h-[460px] p-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold text-[#29312d]">
                {query.trim()
                  ? `No document found for “${query.trim()}”.`
                  : "No recent documents are available for these filters."}
              </p>
              {query.trim() && suggestions.length > 0 && (
                <div className="mt-7 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#874047]">
                    Related documents you may be looking for
                  </p>
                  <div className="mt-3 divide-y divide-[#8f1d2c]/8 overflow-hidden rounded-2xl border border-[#8f1d2c]/10 bg-white">
                    {suggestions.map((suggestion) => (
                      <Link
                        key={suggestion.id}
                        href={`/app/document/${suggestion.id}`}
                        className="block px-4 py-3 transition hover:bg-[#fbf8f2]"
                      >
                        <p className="text-sm font-semibold text-[#29312d]">
                          {suggestion.title}
                        </p>
                        <p className="mt-1 text-[11px] text-[#706a61]">
                          {[humanize(suggestion.type), suggestion.suggestionReason]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#8f1d2c]/7">
            {documents.map((document) => {
              const selected = isSelected(document.id);
              const researchReady = isResearchReady(document);
              const readiness =
                (researchReady ? "research_ready" : null) ||
                document.readinessClass ||
                document.readiness ||
                (document.pdfUrl || document.type === "policy" ? "pdf_available" : "source_only");
              const canPrepare =
                researchReady || canPrepareForResearch(document);
              const compareDisabled = comparisonDisabledReason(document);
              const canPrepareCompare = Boolean(compareDisabled && canPrepare);
              const sourceOnlyActions = isSourceOnlyResearchDocument(document);
              return (
                <article
                  key={document.id}
                  className="grid gap-3 py-5 transition hover:bg-[#f1ece3]/50 md:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_auto]"
                >
                  {sourceOnlyActions ? (
                    <div
                      className="mt-1 grid h-8 w-8 place-items-center rounded-lg border border-[#8f1d2c]/10 bg-[#f7f2eb] text-[10px] font-bold uppercase text-[#81796e]"
                      title="Only the source page is available"
                    >
                      Src
                    </div>
                  ) : (
                    <label className="mt-1 grid h-8 w-8 place-items-center rounded-lg border border-[#8f1d2c]/10 bg-white">
                      <span className="sr-only">
                        Select {document.title} for comparison
                      </span>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={Boolean(compareDisabled)}
                        onChange={() =>
                          selected
                            ? removeDocument(document.id)
                            : addDocument(document)
                        }
                        className="accent-[#8f1d2c]"
                      />
                    </label>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#eee0dc] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#8f1d2c]">
                        {humanize(document.type)}
                      </span>
                      {document.status && (
                        <span className="rounded-full bg-[#e2ece6] px-2 py-1 text-[9px] font-semibold text-[#315a49]">
                          {document.status}
                        </span>
                      )}
                      <span
                        title={document.readinessReason || undefined}
                        className={
                          readiness === "research_ready"
                            ? "rounded-full bg-[#e2ece6] px-2 py-1 text-[9px] font-semibold text-[#315a49]"
                            : readiness === "processing_failed"
                              ? "rounded-full bg-[#f4dfdc] px-2 py-1 text-[9px] font-semibold text-[#85434a]"
                              : "rounded-full bg-[#eee7dc] px-2 py-1 text-[9px] font-semibold text-[#706a61]"
                        }
                      >
                        {READINESS_LABELS[readiness] || "Available"}
                      </span>
                    </div>
                    <h3 className="mt-2 font-serif text-lg leading-6 text-[#29312d]">
                      {document.title}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-[#706a61]">
                      {[
                        document.number,
                        document.ministry || document.authority,
                        document.jurisdiction,
                        document.category && humanize(document.category),
                        documentDateLabel(document),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 md:justify-end">
                    {!sourceOnlyActions && canPrepareCompare && (
                      <button
                        type="button"
                        disabled={
                          (Boolean(compareDisabled) && !canPrepareCompare) ||
                          preparingCompareId === document.id
                        }
                        title={compareDisabled || undefined}
                        onClick={async () => {
                          if (selected) {
                            removeDocument(document.id);
                            return;
                          }
                          if (compareDisabled && canPrepareCompare) {
                            setPreparingCompareId(document.id);
                            try {
                              const result =
                                await prepareAndAddDocument(document);
                              if (!result.ok) setError(result.reason);
                            } catch (prepareError) {
                              setError(
                                prepareError.message ||
                                  "Document could not be prepared for comparison.",
                              );
                            } finally {
                              setPreparingCompareId(null);
                            }
                            return;
                          }
                          const result = addDocument(document);
                          if (!result.ok) setError(result.reason);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#8f1d2c]/10 bg-white px-3 py-2 text-[10px] font-semibold text-[#8f1d2c] disabled:cursor-not-allowed disabled:bg-[#ddd5ca] disabled:text-[#81796e]"
                      >
                        {preparingCompareId === document.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <GitCompareArrows className="h-3.5 w-3.5" />
                        )}
                        {selected
                          ? "Remove"
                          : compareDisabled && canPrepareCompare
                            ? "Prepare first"
                            : "Add to compare"}
                      </button>
                    )}
                    {!sourceOnlyActions && canPrepare ? (
                      <Link
                        href={`/app/document/${document.id}#research-chat`}
                        onClick={() =>
                          trackActivity({
                            event_type: "document_opened",
                            entity_type: document.type,
                            entity_id: document.id,
                            document_id: document.id,
                            page_path: "/app",
                            metadata_json: { documentType: document.type },
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#8f1d2c] px-3 py-2 text-[10px] font-semibold text-white"
                      >
                        {researchReady
                          ? "Open research"
                          : "Prepare first"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : !sourceOnlyActions ? (
                      <span
                        title={
                          document.readinessReason ||
                          document.failureReason ||
                          document.processingError ||
                          "A readable, indexed PDF is required for research."
                        }
                        className="inline-flex cursor-not-allowed items-center rounded-xl bg-[#ddd5ca] px-3 py-2 text-[10px] font-semibold text-[#81796e]"
                      >
                        Research not available
                      </span>
                    ) : null}
                    {shouldShowPdfAction(document) && (
                      <a
                        href={document.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="grid h-8 w-8 place-items-center rounded-xl border border-[#8f1d2c]/10 bg-white text-[#8f1d2c]"
                        aria-label={`Open PDF for ${document.title}`}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {document.sourceUrl && (
                      <a
                        href={document.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="grid h-8 w-8 place-items-center rounded-xl border border-[#8f1d2c]/10 bg-white text-[#8f1d2c]"
                        aria-label={`Open source for ${document.title}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#8f1d2c]/8 bg-[#f7f2eb] px-5 py-4">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          className="rounded-xl border border-[#8f1d2c]/10 bg-white px-4 py-2 text-xs font-semibold text-[#8f1d2c] disabled:opacity-40"
        >
          Previous
        </button>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#706a61]">
          Page {pagination.page || page} of {pagination.totalPages || 1}
        </p>
        <button
          type="button"
          disabled={!pagination.hasMore || loading}
          onClick={() => setPage((current) => current + 1)}
          className="rounded-xl border border-[#8f1d2c]/10 bg-white px-4 py-2 text-xs font-semibold text-[#8f1d2c] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </section>
  );
}
