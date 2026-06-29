import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  FileText,
  ArrowRight,
  AlertCircle,
  XCircle,
  ChevronDown,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  MinusCircle,
  CheckCircle2,
  BookmarkPlus,
  Hourglass,
  GitBranch,
} from "lucide-react";
import {
  fetchBills,
  saveSearch,
  trackActivity,
  trackSearchActivity,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function BillsSidebarUI() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [bills, setBills] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalBills, setTotalBills] = useState(0);
  const { isAuthenticated } = useAuth();


  useEffect(() => {
    const loadInitialBills = async () => {

      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setPage(1);
        setBills([]);

        const response = await fetchBills(1, 10, searchTerm, selectedStatus);

        if (response && response.bills) {
          setBills(response.bills);
          setHasMore(response.pagination?.hasMore || false);
          setTotalBills(response.pagination?.total || 0);


          if (response.statuses && response.statuses.length > 0 && statuses.length === 0) {
            setStatuses(response.statuses);
          }
        } else {
          setBills([]);
          setHasMore(false);
          setTotalBills(0);
        }
      } catch (err) {
        console.error('Failed to fetch bills:', err);
        setError(err.message || 'Failed to load bills. Please try again.');
        setBills([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };


    const timeoutId = setTimeout(() => {
      loadInitialBills();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, searchTerm, selectedStatus]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < 2) return;
    trackSearchActivity({
      event_type: "search_performed",
      entity_type: "bill",
      page_path: "/app",
      search_query: query,
      filters_json: { status: selectedStatus },
      metadata_json: { documentType: "bill" },
    });
  }, [searchTerm, selectedStatus]);

  useEffect(() => {
    if (selectedStatus === "All") return;
    trackActivity({
      event_type: "filter_used",
      entity_type: "bill",
      page_path: "/app",
      filters_json: { status: selectedStatus },
      metadata_json: { documentType: "bill" },
    });
  }, [selectedStatus]);


  const loadMoreBills = async () => {
    if (loadingMore || !hasMore || !isAuthenticated) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await fetchBills(nextPage, 10, searchTerm, selectedStatus);

      if (response && response.bills) {
        setBills(prev => [...prev, ...response.bills]);
        setPage(nextPage);
        setHasMore(response.pagination?.hasMore || false);
      }
    } catch (err) {
      console.error('Failed to load more bills:', err);
    } finally {
      setLoadingMore(false);
    }
  };


  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;

    if (scrollHeight - scrollTop <= clientHeight * 1.2 && hasMore && !loadingMore) {
      loadMoreBills();
    }
  };


  const getStatusIcon = (status) => {
    const statusLower = status?.toLowerCase() || '';


    if (statusLower.includes('passed') || statusLower.includes('enacted') || statusLower.includes('assented')) {
      return { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" };
    }


    if (statusLower.includes('pending') || statusLower.includes('under consideration')) {
      return { icon: Hourglass, color: "text-amber-600", bg: "bg-amber-50" };
    }


    if (statusLower.includes('introduced') || statusLower.includes('tabled')) {
      return { icon: PlayCircle, color: "text-blue-600", bg: "bg-blue-50" };
    }


    if (statusLower.includes('lapsed') || statusLower.includes('withdrawn')) {
      return { icon: MinusCircle, color: "text-orange-600", bg: "bg-orange-50" };
    }


    if (statusLower.includes('rejected') || statusLower.includes('negatived')) {
      return { icon: XCircle, color: "text-red-600", bg: "bg-red-50" };
    }


    if (statusLower.includes('referred') || statusLower.includes('committee')) {
      return { icon: GitBranch, color: "text-purple-600", bg: "bg-purple-50" };
    }


    if (statusLower.includes('hold') || statusLower.includes('paused')) {
      return { icon: PauseCircle, color: "text-slate-600", bg: "bg-slate-50" };
    }


    return { icon: AlertCircle, color: "text-gray-600", bg: "bg-gray-50" };
  };


  const BillSkeleton = () => (
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


  const filteredBills = bills;

  return (
    <div className="surface-card flex h-full min-h-[620px] flex-col overflow-hidden bg-[#f6f2eb]">
      {}
      <div className="border-b border-[#8f1d2c]/8 bg-[#f7f2eb] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8f1d2c] shadow-lg">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-serif text-xl text-[#8f1d2c]">
                Parliament bills
              </h3>
              <p className="text-xs text-[#817a70]">
                Search and open an evidence workspace
              </p>
            </div>
          </div>
          <span className="rounded-full bg-[#e2ece6] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#315a49]">
            Verified public records
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
            placeholder="Search bills by title…"
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
              {selectedStatus === "All" ? "All Status" : selectedStatus}
            </span>
          </div>
          <ChevronDown
            size={14}
            className={`text-slate-500 transition-transform ${
              showFilters ? "rotate-180" : ""
            }`}
          />
        </button>
        <button
          type="button"
          onClick={() =>
            saveSearch({
              name: searchTerm.trim()
                ? `Bills: ${searchTerm.trim()}`
                : "Bill filters",
              query: searchTerm.trim(),
              filters: { status: selectedStatus },
            })
          }
          className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#874047]"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          Save this search
        </button>

        {}
        {showFilters && (
          <div className="mt-2 rounded-xl border border-[#8f1d2c]/9 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Filter Status
              </span>
              {selectedStatus !== "All" && (
                <button
                  onClick={() => setSelectedStatus("All")}
                  className="text-xs text-[#9b2638] hover:text-[#68131f] font-medium"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1">
              <button
                onClick={() => {
                  setSelectedStatus("All");
                  setShowFilters(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedStatus === "All"
                    ? "bg-[#8f1d2c] text-white"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                All Status
              </button>
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setSelectedStatus(status);
                    setShowFilters(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedStatus === status
                      ? "bg-[#8f1d2c] text-white"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {status}
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
            <p className="text-slate-500 text-xs">Please login to view bills</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
            <p className="text-slate-600 text-sm font-medium mb-1">Error Loading Bills</p>
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
              <BillSkeleton key={idx} />
            ))}
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              {searchTerm || selectedStatus !== "All"
                ? "No bills match your filters"
                : "No bills found"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBills.map((bill, idx) => {
              const statusInfo = getStatusIcon(bill.status);
              const StatusIcon = statusInfo.icon;

              return (
                <div key={bill.id || idx} className="block group">
                  <button
                    type="button"
                    onClick={() => {
                      const billData = {
                        billId: bill.id,
                        title: bill.title,
                        pdfUrl: bill.pdf || null,
                        link: bill.link,
                        status: bill.status
                      };
                      trackActivity({
                        event_type: "bill_opened",
                        entity_type: "bill",
                        entity_id: bill.id,
                        document_id: bill.id,
                        page_path: "/app",
                        metadata_json: {
                          documentType: "bill",
                          status: bill.status,
                        },
                      });
                      window.open(`/app/bill-chat?bill=${encodeURIComponent(JSON.stringify(billData))}`, '_blank');
                    }}
                    className="w-full cursor-pointer rounded-2xl border border-[#8f1d2c]/9 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#8c4548]/30 hover:shadow-[0_14px_35px_rgba(143, 29, 44,0.08)]"
                    aria-label={`Open research chat for ${bill.title}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="flex-1 text-sm font-semibold leading-5 text-[#29312d] transition-colors group-hover:text-[#874047]">
                        {bill.title}
                      </h4>
                      <ArrowRight
                        size={14}
                        className="mt-0.5 shrink-0 text-[#874047] transition-all group-hover:translate-x-0.5"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      {bill.status ? (
                        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full ${statusInfo.bg}`}>
                          <StatusIcon size={13} className={statusInfo.color} />
                          <span
                            className={`text-xs font-semibold ${statusInfo.color}`}
                          >
                            {bill.status}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-gray-50">
                          <AlertCircle size={13} className="text-gray-600" />
                          <span className="text-xs font-semibold text-gray-600">Status Unknown</span>
                        </div>
                      )}
                      <span className="text-xs font-medium text-[#8b8378]">
                        Open workspace →
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
                  <BillSkeleton key={`loading-${idx}`} />
                ))}
              </>
            )}

            {}
            {!loadingMore && !hasMore && filteredBills.length > 0 && (
              <div className="text-center py-4">
                <p className="text-slate-400 text-xs">
                  No more bills to load
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
            {filteredBills.length}/{totalBills} bill{filteredBills.length !== 1 ? "s" : ""} loaded
            {hasMore && <span className="text-slate-400 ml-1">(scroll for more)</span>}
          </span>
          <span className="text-slate-400">
            Verified legislative references
          </span>
        </div>
      </div>
    </div>
  );
}
