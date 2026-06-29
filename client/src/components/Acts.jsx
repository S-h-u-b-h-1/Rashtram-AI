import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  ArrowRight,
  AlertCircle,
  XCircle,
  ChevronDown,
  AlertTriangle,
  PauseCircle,
  MinusCircle,
  CheckCircle2,
  Hourglass,
  GitBranch,
  Scale,
} from "lucide-react";
import {
  fetchActs,
  fetchActYears,
  trackActivity,
  trackSearchActivity,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function ActsSidebarUI() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("All");
  const [acts, setActs] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalActs, setTotalActs] = useState(0);
  const { isAuthenticated } = useAuth();


  useEffect(() => {
    const loadInitialActs = async () => {

      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setPage(1);
        setActs([]);

        const response = await fetchActs(1, 10, searchTerm, selectedYear);

        if (response && response.acts) {
          setActs(response.acts);
          setHasMore(response.pagination?.hasMore || false);
          setTotalActs(response.pagination?.total || 0);


          if (response.years && selectedYear === "All") {
            setYears(response.years);
          }
        } else {
          setActs([]);
          setHasMore(false);
          setTotalActs(0);
        }
      } catch (err) {
        console.error('Failed to fetch acts:', err);
        setError(err.message || 'Failed to load acts. Please try again.');
        setActs([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };


    const timeoutId = setTimeout(() => {
      loadInitialActs();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, searchTerm, selectedYear]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < 2) return;
    trackSearchActivity({
      event_type: "search_performed",
      entity_type: "act",
      page_path: "/app",
      search_query: query,
      filters_json: { year: selectedYear },
      metadata_json: { documentType: "act" },
    });
  }, [searchTerm, selectedYear]);

  useEffect(() => {
    if (selectedYear === "All") return;
    trackActivity({
      event_type: "filter_used",
      entity_type: "act",
      page_path: "/app",
      filters_json: { year: selectedYear },
      metadata_json: { documentType: "act" },
    });
  }, [selectedYear]);


  const loadMoreActs = async () => {
    if (loadingMore || !hasMore || !isAuthenticated) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await fetchActs(nextPage, 10, searchTerm, selectedYear);

      if (response && response.acts) {
        setActs(prev => [...prev, ...response.acts]);
        setPage(nextPage);
        setHasMore(response.pagination?.hasMore || false);
      }
    } catch (err) {
      console.error('Failed to load more acts:', err);
    } finally {
      setLoadingMore(false);
    }
  };


  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight * 1.2 && hasMore && !loadingMore) {
      loadMoreActs();
    }
  };

  const getStatusIcon = (status) => {
    const statusLower = status?.toLowerCase() || '';


    if (statusLower.includes('enacted') || statusLower.includes('active') || statusLower.includes('in force')) {
      return { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" };
    }


    if (statusLower.includes('amended')) {
      return { icon: GitBranch, color: "text-blue-600", bg: "bg-blue-50" };
    }


    if (statusLower.includes('repealed') || statusLower.includes('abolished')) {
      return { icon: XCircle, color: "text-red-600", bg: "bg-red-50" };
    }


    if (statusLower.includes('pending') || statusLower.includes('under review')) {
      return { icon: Hourglass, color: "text-amber-600", bg: "bg-amber-50" };
    }


    if (statusLower.includes('partial')) {
      return { icon: MinusCircle, color: "text-orange-600", bg: "bg-orange-50" };
    }


    if (statusLower.includes('suspended')) {
      return { icon: PauseCircle, color: "text-slate-600", bg: "bg-slate-50" };
    }


    return { icon: Scale, color: "text-gray-600", bg: "bg-gray-50" };
  };


  const ActSkeleton = () => (
    <div className="animate-pulse rounded-2xl border border-[#8f1d2c]/8 bg-white p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div className="h-4 w-4 bg-slate-200 rounded"></div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center space-x-2">
          <div className="h-3 w-3 bg-slate-200 rounded-full"></div>
          <div className="h-3 bg-slate-200 rounded w-16"></div>
        </div>
        <div className="h-3 bg-slate-200 rounded w-20"></div>
      </div>
    </div>
  );


  const filteredActs = acts;

  return (
    <div className="surface-card flex h-full min-h-[620px] flex-col overflow-hidden bg-[#f6f2eb]">
      {}
      <div className="border-b border-[#8f1d2c]/8 bg-[#f7f2eb] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8f1d2c] shadow-lg">
              <Scale size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-serif text-xl text-[#8f1d2c]">
                Parliament acts
              </h3>
              <p className="text-xs text-[#817a70]">
                Research enacted law and its context
              </p>
            </div>
          </div>
          <span className="rounded-full bg-[#e2ece6] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#315a49]">
            Official public records
          </span>
        </div>

        {}
        <div className="relative mb-3">
          <Search
            size={14}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#918a7f]"
          />
          <input
            type="text"
            placeholder="Search acts by title…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 w-full rounded-xl border border-[#8f1d2c]/10 bg-white pl-11 pr-4 text-sm text-[#8f1d2c] placeholder:text-[#9a9387] focus:border-[#a85a52] focus:outline-none focus:ring-4 focus:ring-[#a85a52]/10"
          />
        </div>

        {}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex w-full items-center justify-between rounded-xl border border-[#8f1d2c]/8 bg-[#f0e9de] px-4 py-3 text-sm transition hover:bg-[#e9e0d2]"
        >
          <div className="flex items-center space-x-2 text-[#514d46]">
            <Filter size={14} />
            <span className="font-medium">
              {selectedYear === "All" ? "All Years" : selectedYear}
            </span>
          </div>
          <ChevronDown
            size={14}
            className={`text-slate-500 transition-transform ${
              showFilters ? "rotate-180" : ""
            }`}
          />
        </button>

        {}
        {showFilters && (
          <div className="mt-2 rounded-xl border border-[#8f1d2c]/9 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Filter by Year
              </span>
              {selectedYear !== "All" && (
                <button
                  onClick={() => setSelectedYear("All")}
                  className="text-xs text-[#9b2638] hover:text-[#68131f] font-medium"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedYear("All");
                  setShowFilters(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedYear === "All"
                    ? "bg-[#8f1d2c] text-white"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                All Years
              </button>
              {[...years].sort((a, b) => b - a).map((year) => (
                <button
                  key={year}
                  onClick={() => {
                    setSelectedYear(year.toString());
                    setShowFilters(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedYear === year.toString()
                      ? "bg-[#8f1d2c] text-white"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {}
      <div
        className="app-scrollbar flex-1 overflow-y-auto p-4 sm:p-5"
        onScroll={handleScroll}
      >
        {!isAuthenticated ? (
          <div className="text-center py-8">
            <AlertTriangle size={32} className="text-yellow-500 mx-auto mb-2" />
            <p className="text-slate-600 text-sm font-medium mb-1">Authentication Required</p>
            <p className="text-slate-500 text-xs">Please login to view acts</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
            <p className="text-slate-600 text-sm font-medium mb-1">Error Loading Acts</p>
            <p className="text-slate-500 text-xs mb-3">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#9b2638] text-white text-sm rounded-lg hover:bg-[#68131f] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <ActSkeleton key={idx} />
            ))}
          </div>
        ) : filteredActs.length === 0 ? (
          <div className="text-center py-8">
            <Scale size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              {searchTerm || selectedYear !== "All"
                ? "No acts match your filters"
                : "No acts found"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredActs.map((act, idx) => {
              const statusInfo = getStatusIcon(act.status);
              const StatusIcon = statusInfo.icon;
              const hasPdf = act.pdf && act.pdf !== null;

              return (
                <div key={act.id || idx} className="block group">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasPdf) {

                        const actData = {
                          actId: act.id,
                          title: act.title,
                          pdfUrl: act.pdf,
                          link: act.link,
                          status: act.status
                        };
                        trackActivity({
                          event_type: "act_opened",
                          entity_type: "act",
                          entity_id: act.id,
                          document_id: act.id,
                          page_path: "/app",
                          metadata_json: {
                            documentType: "act",
                            status: act.status,
                          },
                        });
                        window.open(`/app/act-chat?act=${encodeURIComponent(JSON.stringify(actData))}`, '_blank');
                      } else if (act.link) {
                        trackActivity({
                          event_type: "source_opened",
                          entity_type: "act",
                          entity_id: act.id,
                          document_id: act.id,
                          page_path: "/app",
                          metadata_json: { documentType: "act" },
                        });
                        window.open(act.link, '_blank');
                      }
                    }}
                    className={`w-full rounded-2xl border border-[#8f1d2c]/9 bg-white p-4 text-left transition-all hover:border-[#8c4548]/30 ${
                      hasPdf || act.link ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(143, 29, 44,0.08)]' : 'cursor-default'
                    }`}
                    aria-label={`Open ${act.title}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="flex-1 text-sm font-semibold leading-5 text-[#29312d] transition-colors group-hover:text-[#874047]">
                        {act.title}
                      </h4>
                      {(hasPdf || act.link) && (
                        <ArrowRight
                          size={14}
                          className="mt-0.5 shrink-0 text-[#874047] transition-all group-hover:translate-x-0.5"
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      {act.status ? (
                        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full ${statusInfo.bg}`}>
                          <StatusIcon size={13} className={statusInfo.color} />
                          <span
                            className={`text-xs font-semibold ${statusInfo.color}`}
                          >
                            {act.status}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-gray-50">
                          <AlertCircle size={13} className="text-gray-600" />
                          <span className="text-xs font-semibold text-gray-600">Status Unknown</span>
                        </div>
                      )}
                      <span className="text-xs font-medium text-[#8b8378]">
                        {hasPdf ? 'Open workspace →' : 'View details →'}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}

            {}
            {loadingMore && (
              <>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <ActSkeleton key={`loading-${idx}`} />
                ))}
              </>
            )}

            {}
            {!loadingMore && !hasMore && filteredActs.length > 0 && (
              <div className="text-center py-4">
                <p className="text-slate-400 text-xs">
                  No more acts to load
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {}
      <div className="border-t border-[#8f1d2c]/8 bg-[#f7f2eb] p-4">
        <div className="flex items-center justify-between text-xs text-[#777065]">
          <span>
            {filteredActs.length}/{totalActs} act{filteredActs.length !== 1 ? "s" : ""} loaded
            {hasMore && <span className="text-slate-400 ml-1">(scroll for more)</span>}
          </span>
          <span className="text-slate-400">Official acts repository</span>
        </div>
      </div>
    </div>
  );
}
