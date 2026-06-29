"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  BookOpenText,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileDown,
  Filter,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  fetchEGazettes,
  saveSearch,
  trackActivity,
  trackSearchActivity,
} from "@/lib/api";
import { formatDate, humanize } from "@/lib/document-links";
import { getPublicSourceLabel } from "@/lib/source-branding";

const EMPTY_FILTERS = {
  ministry: "",
  department: "",
  notificationType: "",
  gazetteType: "",
  jurisdiction: "",
  year: "",
  publicationFrom: "",
  publicationTo: "",
  source: "",
  hasPdf: "",
};

const SelectFilter = ({ label, value, options, onChange }) => (
  <label className="space-y-1.5">
    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777066]">
      {label}
    </span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-xs text-[#29312d] outline-none focus:border-[#a85a52]"
    >
      <option value="">All</option>
      {options.map((option) => (
        <option
          key={String(option.value ?? option)}
          value={String(option.value ?? option)}
        >
          {option.label || humanize(option)}
        </option>
      ))}
    </select>
  </label>
);

const GazetteActions = ({ gazette }) => {
  const researchHref = `/app/egazette-chat/${gazette.id}`;
  const trackOpen = (eventType = "document_opened") =>
    trackActivity({
      event_type: eventType,
      entity_type: "gazette",
      entity_id: gazette.id,
      document_id: gazette.id,
      page_path: "/app/egazette",
      metadata_json: {
        documentType: gazette.notificationType || "gazette",
        category: gazette.gazetteType,
        ministry: gazette.ministry,
        jurisdiction: gazette.jurisdiction,
      },
    });

  return (
    <div className="flex flex-wrap gap-1.5">
      <Link
        href={researchHref}
        onClick={() => trackOpen()}
        className="rounded-full border border-[#8f1d2c]/12 px-2.5 py-1.5 text-[10px] font-semibold text-[#514d46] hover:bg-[#f1ece3]"
      >
        Open
      </Link>
      <Link
        href={researchHref}
        onClick={() => trackOpen("research_continued")}
        className="inline-flex items-center gap-1 rounded-full bg-[#8f1d2c] px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-[#6f1420]"
      >
        <BookOpenText className="h-3 w-3" />
        Research
      </Link>
      {gazette.pdfUrl && (
        <a
          href={gazette.pdfUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackOpen("document_opened")}
          className="inline-flex items-center gap-1 rounded-full border border-[#8f1d2c]/12 px-2.5 py-1.5 text-[10px] font-semibold text-[#514d46] hover:bg-[#f1ece3]"
        >
          <FileDown className="h-3 w-3" />
          PDF
        </a>
      )}
      {gazette.sourceUrl && (
        <a
          href={gazette.sourceUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackOpen("source_opened")}
          className="inline-flex items-center gap-1 rounded-full border border-[#8f1d2c]/12 px-2.5 py-1.5 text-[10px] font-semibold text-[#514d46] hover:bg-[#f1ece3]"
        >
          <ExternalLink className="h-3 w-3" />
          Source
        </a>
      )}
    </div>
  );
};

export default function EGazette() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("publicationDate");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const [gazettes, setGazettes] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetchEGazettes({
          page,
          limit: 20,
          search: search.trim(),
          ...filters,
          sortBy,
          sortDirection,
        });
        setGazettes(response.gazettes || []);
        setPagination(response.pagination || {});
        if (response.filters) setFilterOptions(response.filters);
      } catch (requestError) {
        setError(requestError.message || "Unable to load Gazette records.");
        setGazettes([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, page, search, sortBy, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [filters, search, sortBy, sortDirection]);

  useEffect(() => {
    if (search.trim().length < 2) return;
    trackSearchActivity({
      event_type: "search_performed",
      entity_type: "gazette",
      page_path: "/app/egazette",
      search_query: search.trim(),
      filters_json: filters,
      metadata_json: { documentType: "gazette" },
    });
  }, [filters, search]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    if (value) {
      trackActivity({
        event_type: "filter_used",
        entity_type: "gazette",
        page_path: "/app/egazette",
        filters_json: { [key]: value },
        metadata_json: { documentType: "gazette" },
      });
    }
  };

  const toggleSortDirection = () =>
    setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[#8f1d2c]/8 bg-[#f7f2eb] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
              Official Gazette research
            </p>
            <h2 className="mt-2 font-serif text-3xl text-[#8f1d2c]">
              eGazette
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#706a61]">
              Search notifications, rules, ordinances, and government orders.
              PDFs are processed for AI research only when you open them.
            </p>
          </div>
          <div className="rounded-2xl bg-[#eee0dc] px-4 py-3 text-right">
            <p className="font-serif text-2xl text-[#8f1d2c]">
              {Number(pagination.total || 0).toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#777066]">
              Gazette records
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#918a7f]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, Gazette number, ministry, notification number, or metadata…"
              className="h-12 w-full rounded-xl border border-[#8f1d2c]/10 bg-white pl-11 pr-4 text-sm text-[#29312d] outline-none placeholder:text-[#9a9387] focus:border-[#a85a52] focus:ring-4 focus:ring-[#a85a52]/10"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowFilters((visible) => !visible)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#8f1d2c]/10 bg-white px-4 text-xs font-semibold text-[#514d46]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#8f1d2c] text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() =>
              saveSearch({
                name: search.trim()
                  ? `Gazette: ${search.trim()}`
                  : "Gazette filters",
                query: search.trim(),
                filters,
              })
            }
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-[10px] font-semibold text-[#874047]"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save this search
          </button>
          <div className="flex">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="h-12 rounded-l-xl border border-r-0 border-[#8f1d2c]/10 bg-white px-3 text-xs text-[#514d46] outline-none"
              aria-label="Sort Gazette records"
            >
              <option value="publicationDate">Publication date</option>
              <option value="title">Title</option>
              <option value="ministry">Ministry</option>
              <option value="gazetteNumber">Gazette number</option>
              <option value="updatedAt">Last updated</option>
            </select>
            <button
              type="button"
              onClick={toggleSortDirection}
              className="grid h-12 w-12 place-items-center rounded-r-xl border border-[#8f1d2c]/10 bg-white text-[#8f1d2c]"
              aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
            >
              {sortDirection === "asc" ? (
                <ArrowDownAZ className="h-4 w-4" />
              ) : (
                <ArrowUpAZ className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 rounded-2xl border border-[#8f1d2c]/9 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SelectFilter
                label="Ministry"
                value={filters.ministry}
                options={filterOptions.ministries || []}
                onChange={(value) => updateFilter("ministry", value)}
              />
              <SelectFilter
                label="Department"
                value={filters.department}
                options={filterOptions.departments || []}
                onChange={(value) => updateFilter("department", value)}
              />
              <SelectFilter
                label="Notification type"
                value={filters.notificationType}
                options={filterOptions.notificationTypes || []}
                onChange={(value) =>
                  updateFilter("notificationType", value)
                }
              />
              <SelectFilter
                label="Gazette type"
                value={filters.gazetteType}
                options={filterOptions.gazetteTypes || []}
                onChange={(value) => updateFilter("gazetteType", value)}
              />
              <SelectFilter
                label="Jurisdiction"
                value={filters.jurisdiction}
                options={filterOptions.jurisdictions || []}
                onChange={(value) => updateFilter("jurisdiction", value)}
              />
              <SelectFilter
                label="Year"
                value={filters.year}
                options={filterOptions.years || []}
                onChange={(value) => updateFilter("year", value)}
              />
              <SelectFilter
                label="Source"
                value={filters.source}
                options={filterOptions.sources || []}
                onChange={(value) => updateFilter("source", value)}
              />
              <SelectFilter
                label="PDF availability"
                value={filters.hasPdf}
                options={[
                  { label: "Has PDF", value: "true" },
                  { label: "No PDF", value: "false" },
                ]}
                onChange={(value) => updateFilter("hasPdf", value)}
              />
              <label className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777066]">
                  Published after
                </span>
                <input
                  type="date"
                  value={filters.publicationFrom}
                  onChange={(event) =>
                    updateFilter("publicationFrom", event.target.value)
                  }
                  className="h-10 w-full rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-xs text-[#29312d]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777066]">
                  Published before
                </span>
                <input
                  type="date"
                  value={filters.publicationTo}
                  onChange={(event) =>
                    updateFilter("publicationTo", event.target.value)
                  }
                  className="h-10 w-full rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-xs text-[#29312d]"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#8f1d2c]"
            >
              <Filter className="h-3.5 w-3.5" />
              Clear all filters
            </button>
          </div>
        )}
      </div>

      <div className="min-h-[440px]">
        {loading ? (
          <div className="grid min-h-[440px] place-items-center">
            <div className="text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#8f1d2c]/15 border-t-[#8f1d2c]" />
              <p className="mt-3 text-xs text-[#777066]">
                Searching the Gazette catalogue…
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="grid min-h-[440px] place-items-center p-8 text-center">
            <div>
              <p className="font-serif text-xl text-[#8f1d2c]">
                Gazette records are temporarily unavailable.
              </p>
              <p className="mt-2 text-sm text-[#85434a]">{error}</p>
            </div>
          </div>
        ) : gazettes.length === 0 ? (
          <div className="grid min-h-[440px] place-items-center p-8 text-center">
            <div>
              <BookOpenText className="mx-auto h-7 w-7 text-[#9b9387]" />
              <p className="mt-3 text-sm font-semibold text-[#514d46]">
                No Gazette records match these filters.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1180px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#8f1d2c]/8 bg-[#f1ece3]/55 text-[10px] uppercase tracking-[0.1em] text-[#777066]">
                    {[
                      "Gazette title",
                      "Gazette number",
                      "Type",
                      "Ministry / Department",
                      "Publication date",
                      "Jurisdiction",
                      "Source",
                      "Status",
                      "Actions",
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8f1d2c]/7">
                  {gazettes.map((gazette) => (
                    <tr key={gazette.id} className="align-top hover:bg-[#f7f2eb]">
                      <td className="max-w-[300px] px-4 py-4">
                        <p className="line-clamp-3 text-sm font-semibold leading-5 text-[#29312d]">
                          {gazette.title}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] text-[#706a61]">
                        {gazette.gazetteNumber || "—"}
                      </td>
                      <td className="px-4 py-4 text-xs text-[#514d46]">
                        {humanize(gazette.notificationType)}
                        {gazette.gazetteType && (
                          <span className="mt-1 block text-[10px] text-[#8a8277]">
                            {humanize(gazette.gazetteType)}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[220px] px-4 py-4 text-xs leading-5 text-[#514d46]">
                        {gazette.ministry || gazette.authority || "—"}
                        {gazette.department && (
                          <span className="block text-[10px] text-[#8a8277]">
                            {gazette.department}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-[#514d46]">
                        {formatDate(gazette.publicationDate)}
                      </td>
                      <td className="px-4 py-4 text-xs text-[#514d46]">
                        {gazette.jurisdiction || "India"}
                      </td>
                      <td className="px-4 py-4 text-xs text-[#514d46]">
                        {getPublicSourceLabel(gazette.sourceName)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-[#e2ece6] px-2 py-1 text-[10px] font-semibold text-[#315a49]">
                          {gazette.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <GazetteActions gazette={gazette} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {gazettes.map((gazette) => (
                <article
                  key={gazette.id}
                  className="rounded-2xl border border-[#8f1d2c]/9 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#874047]">
                        {humanize(gazette.notificationType)}
                      </p>
                      <h3 className="mt-2 text-sm font-semibold leading-5 text-[#29312d]">
                        {gazette.title}
                      </h3>
                    </div>
                    <span className="rounded-full bg-[#e2ece6] px-2 py-1 text-[9px] font-semibold text-[#315a49]">
                      {gazette.status}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <dt className="text-[#8a8277]">Gazette number</dt>
                      <dd className="mt-1 break-all font-mono text-[#514d46]">
                        {gazette.gazetteNumber || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#8a8277]">Published</dt>
                      <dd className="mt-1 text-[#514d46]">
                        {formatDate(gazette.publicationDate)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[#8a8277]">Ministry / Department</dt>
                      <dd className="mt-1 text-[#514d46]">
                        {gazette.ministry || gazette.department || "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <GazetteActions gazette={gazette} />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#8f1d2c]/8 bg-[#f7f2eb] px-4 py-3">
        <p className="text-[11px] text-[#777066]">
          Page {pagination.page || 1} of {pagination.totalPages || 1}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#8f1d2c]/10 bg-white text-[#8f1d2c] disabled:opacity-35"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!pagination.hasMore || loading}
            onClick={() => setPage((current) => current + 1)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#8f1d2c]/10 bg-white text-[#8f1d2c] disabled:opacity-35"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
