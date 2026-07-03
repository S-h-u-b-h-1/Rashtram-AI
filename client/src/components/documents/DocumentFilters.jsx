"use client";

import { Filter, Search, X } from "lucide-react";

const OPTIONS = [
  ["type", "Type", "types"],
  ["status", "Status", "statuses"],
  ["year", "Year", "years"],
  ["ministry", "Ministry", "ministries"],
  ["authority", "Authority", "authorities"],
  ["category", "Category", "categories"],
  ["jurisdiction", "Jurisdiction", "jurisdictions"],
  ["source", "Source", "sources"],
  ["sourceType", "Source type", "source_types"],
  ["language", "Language", "languages"],
  ["state", "State", "states"],
];

const label = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function DocumentFilters({
  query,
  filters,
  options,
  showType = true,
  filterKeys,
  filterLabels = {},
  sortBy = "publicationDate",
  sortDirection = "desc",
  onQueryChange,
  onFilterChange,
  onSortChange,
  onSortDirectionChange,
  onClear,
}) {
  const availableOptions = showType
    ? OPTIONS
    : OPTIONS.filter(([key]) => key !== "type");
  const visibleOptions = filterKeys?.length
    ? availableOptions.filter(([key]) => filterKeys.includes(key))
    : availableOptions;
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Search legislative documents</span>
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#918a7f]" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search title, number, ministry, authority, category, metadata, or PDF text…"
          className="h-12 w-full rounded-xl border border-[#8f1d2c]/10 bg-white pl-11 pr-4 text-sm text-[#29312d] outline-none placeholder:text-[#9a9387] focus:border-[#a85a52] focus:ring-4 focus:ring-[#a85a52]/10"
        />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        {visibleOptions.map(([key, optionLabel, source]) => (
          <label key={key} className="min-w-[150px] flex-1 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777066]">
              {filterLabels[key] || optionLabel}
            </span>
            <select
              value={filters[key] || ""}
              onChange={(event) => onFilterChange(key, event.target.value)}
              className="h-10 w-full rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-xs text-[#29312d] outline-none focus:border-[#a85a52]"
            >
              <option value="">All</option>
              {(options[source] || []).map((option) => (
                <option key={String(option)} value={String(option)}>
                  {label(option)}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777066]">
            PDF
          </span>
          <select
            value={filters.hasPdf || ""}
            onChange={(event) =>
              onFilterChange("hasPdf", event.target.value)
            }
            className="h-10 rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-xs text-[#29312d]"
          >
            <option value="">All</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
        </label>
        {[
          ["researchReady", "Research"],
          ["comparisonReady", "Comparison"],
        ].map(([key, text]) => (
          <label key={key} className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777066]">
              {text}
            </span>
            <select
              value={filters[key] || ""}
              onChange={(event) => onFilterChange(key, event.target.value)}
              className="h-10 rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-xs text-[#29312d]"
            >
              <option value="">All</option>
              <option value="true">Ready only</option>
              <option value="false">Not ready</option>
            </select>
          </label>
        ))}
        {["publicationFrom", "publicationTo"].map((key) => (
          <label key={key} className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777066]">
              {key === "publicationFrom" ? "From date" : "To date"}
            </span>
            <input
              type="date"
              value={filters[key] || ""}
              onChange={(event) => onFilterChange(key, event.target.value)}
              className="h-10 rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-xs text-[#29312d]"
            />
          </label>
        ))}
        {onSortChange && (
          <label className="min-w-[150px] space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777066]">
              Sort
            </span>
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value)}
              className="h-10 w-full rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-xs text-[#29312d]"
            >
              <option value="publicationDate">Publication date</option>
              <option value="updatedAt">Recently updated</option>
              <option value="year">Year</option>
              <option value="title">Title</option>
              <option value="ministry">Ministry</option>
              {query.trim() && <option value="relevance">Relevance</option>}
            </select>
          </label>
        )}
        {onSortDirectionChange && sortBy !== "relevance" && (
          <label className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777066]">
              Direction
            </span>
            <select
              value={sortDirection}
              onChange={(event) =>
                onSortDirectionChange(event.target.value)
              }
              className="h-10 rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-xs text-[#29312d]"
            >
              <option value="desc">
                {sortBy === "title" || sortBy === "ministry"
                  ? "Z–A"
                  : "Newest first"}
              </option>
              <option value="asc">
                {sortBy === "title" || sortBy === "ministry"
                  ? "A–Z"
                  : "Oldest first"}
              </option>
            </select>
          </label>
        )}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-xs font-semibold text-[#8f1d2c]"
          >
            <X className="h-3.5 w-3.5" />
            Clear {activeCount}
          </button>
        )}
        <span className="inline-flex h-10 items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#777066]">
          <Filter className="h-3.5 w-3.5" />
          Universal filters
        </span>
      </div>
    </div>
  );
}
