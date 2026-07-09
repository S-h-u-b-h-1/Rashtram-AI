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
import { useEffect, useMemo, useState } from "react";
import {
  fetchDocuments,
  saveSearch,
  trackActivity,
  trackSearchActivity,
} from "@/lib/api";
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
  research_ready: "Research Ready",
  comparison_ready: "Research Ready",
  pdf_available: "PDF Available",
  processing_failed: "Processing Failed",
  source_only: "Source Only",
  missing_pdf: "Missing PDF",
  processing_pending: "Processing Pending",
  processing_failed_retriable: "Retry Available",
  source_extractable_not_processed: "Source Available",
  processing_failed_permanent: "Processing Unavailable",
  ocr_required: "OCR Required",
  unsupported_file_type: "Unsupported File",
  invalid_or_quarantined: "Quarantined",
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
  eyebrow = "Universal legislative catalogue",
  filterKeys,
  filterLabels,
  dataNote,
  initialQuery = "",
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [documents, setDocuments] = useState([]);
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
  const [sortBy, setSortBy] = useState("publicationDate");
  const [sortDirection, setSortDirection] = useState("desc");
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
      scope,
      source: source || filters.source,
      jurisdictionLevel,
    }),
    [filters, jurisdictionLevel, scope, source, type],
  );

  useEffect(() => {
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
        });
        setDocuments(response.documents || []);
        setPagination(response.pagination || {});
        setFilterOptions(response.filters || {});
      } catch (requestError) {
        setError(requestError.message || "Unable to load documents.");
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [page, query, requestFilters, sortBy, sortDirection]);

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
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[#8f1d2c]/8 bg-[#f7f2eb] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
              {eyebrow}
            </p>
            <h2 className="mt-2 font-serif text-3xl text-[#8f1d2c]">
              {title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#706a61]">
              {description}
            </p>
          </div>
          <div className="rounded-2xl bg-[#eee0dc] px-4 py-3 text-right">
            <p className="font-serif text-2xl text-[#8f1d2c]">
              {Number(pagination.total || 0).toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#777066]">
              Verified records
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
            onQueryChange={setQuery}
            onFilterChange={updateFilter}
            onSortChange={setSortBy}
            onSortDirectionChange={setSortDirection}
            onClear={() => setFilters(EMPTY_FILTERS)}
          />
        </div>
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

      <div className="min-h-[460px]">
        {loading ? (
          <div className="grid min-h-[460px] place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#8f1d2c]" />
          </div>
        ) : error ? (
          <div className="grid min-h-[460px] place-items-center p-8 text-center">
            <p className="text-sm text-[#85434a]">{error}</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="grid min-h-[460px] place-items-center p-8 text-center">
            <p className="text-sm text-[#706a61]">
              No recent documents are available for these filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#8f1d2c]/7">
            {documents.map((document) => {
              const selected = isSelected(document.id);
              const readiness =
                document.readinessClass ||
                document.readiness ||
                (document.pdfUrl || document.type === "policy" ? "pdf_available" : "source_only");
              const canPrepare =
                document.researchReady || canPrepareForResearch(document);
              const compareDisabled = comparisonDisabledReason(document);
              const canPrepareCompare = Boolean(compareDisabled && canPrepare);
              return (
                <article
                  key={document.id}
                  className="grid gap-4 p-5 transition hover:bg-[#fbf8f2] md:grid-cols-[auto_minmax(0,1fr)_auto]"
                >
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
                      {document.comparisonReady && (
                        <span className="rounded-full bg-[#e6e1f1] px-2 py-1 text-[9px] font-semibold text-[#554477]">
                          Comparison Ready
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-serif text-lg leading-6 text-[#29312d]">
                      {document.title}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-[#777066]">
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
                            const result = await prepareAndAddDocument(document);
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
                        ? "Remove compare"
                        : compareDisabled && canPrepareCompare
                          ? "Prepare & compare"
                          : "Add to compare"}
                    </button>
                    {canPrepare ? (
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
                        {document.researchReady
                          ? "Research"
                          : "Prepare research"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span
                        title={
                          document.readinessReason ||
                          document.failureReason ||
                          document.processingError ||
                          "A readable, indexed PDF is required for research."
                        }
                        className="inline-flex cursor-not-allowed items-center rounded-xl bg-[#ddd5ca] px-3 py-2 text-[10px] font-semibold text-[#81796e]"
                      >
                        Research unavailable
                      </span>
                    )}
                    {document.pdfUrl && (
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777066]">
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
