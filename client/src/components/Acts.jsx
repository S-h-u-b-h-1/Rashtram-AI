import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
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
import { fetchActs, fetchActYears } from "@/lib/api";
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

  const openIndiaCode = () => {
    window.open("https://www.indiacode.nic.in/", "_blank");
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
    <div className="bg-white border border-slate-200 rounded-lg p-3 animate-pulse">
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
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-50 to-white">
      {}
      <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#B20F38] to-[#8A0C2D] rounded-lg flex items-center justify-center shadow-lg">
              <Scale size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-slate-800 font-bold text-sm">
                Acts Tracker
              </h3>
              <p className="text-slate-500 text-xs">Parliamentary acts</p>
            </div>
          </div>
          <button
            onClick={openIndiaCode}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            title="Open India Code"
          >
            <ExternalLink size={14} className="text-slate-600" />
          </button>
        </div>

        {}
        <div className="relative mb-2">
          <Search
            size={14}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search acts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#B20F38] focus:ring-1 focus:ring-[#B20F38]/20 transition-all"
          />
        </div>

        {}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm"
        >
          <div className="flex items-center space-x-2 text-slate-700">
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
          <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Filter by Year
              </span>
              {selectedYear !== "All" && (
                <button
                  onClick={() => setSelectedYear("All")}
                  className="text-xs text-[#B20F38] hover:text-[#8A0C2D] font-medium"
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
                    ? "bg-[#B20F38] text-white"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                All Years
              </button>
              {years.sort((a, b) => b - a).map((year) => (
                <button
                  key={year}
                  onClick={() => {
                    setSelectedYear(year.toString());
                    setShowFilters(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedYear === year.toString()
                      ? "bg-[#B20F38] text-white"
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
      <div className="flex-1 overflow-y-auto p-3" onScroll={handleScroll}>
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
              className="px-4 py-2 bg-[#B20F38] text-white text-sm rounded-lg hover:bg-[#8A0C2D] transition-colors"
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
                  <div
                    onClick={() => {
                      if (hasPdf) {

                        const actData = {
                          actId: act.id,
                          title: act.title,
                          pdfUrl: act.pdf,
                          link: act.link,
                          status: act.status
                        };
                        window.open(`/app/act-chat?act=${encodeURIComponent(JSON.stringify(actData))}`, '_blank');
                      } else if (act.link) {
                        window.open(act.link, '_blank');
                      }
                    }}
                    className={`bg-white border border-slate-200 rounded-lg p-3 transition-all hover:shadow-md hover:border-[#B20F38]/30 ${
                      hasPdf || act.link ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-slate-800 font-semibold text-sm leading-tight group-hover:text-[#B20F38] transition-colors flex-1">
                        {act.title}
                      </h4>
                      {(hasPdf || act.link) && (
                        <ArrowRight
                          size={14}
                          className="text-[#B20F38] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5"
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
                      <span className="text-xs text-slate-400 font-medium">
                        {hasPdf ? 'Open chat →' : 'View details →'}
                      </span>
                    </div>
                  </div>
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
      <div className="p-3 border-t border-slate-200 bg-white/50">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            {filteredActs.length}/{totalActs} act{filteredActs.length !== 1 ? "s" : ""} loaded
            {hasMore && <span className="text-slate-400 ml-1">(scroll for more)</span>}
          </span>
          <span className="text-slate-400">India Code</span>
        </div>
      </div>
    </div>
  );
}
