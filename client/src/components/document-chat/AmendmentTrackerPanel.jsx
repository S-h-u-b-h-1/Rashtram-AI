"use client";

import { GitCompareArrows, Loader2 } from "lucide-react";
import { useState } from "react";
import { getAmendmentTracker } from "@/lib/api";

export function AmendmentTrackerPanel({ documentId }) {
  const [tracker, setTracker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!documentId || loading) return;
    setLoading(true);
    setError("");
    try { setTracker(await getAmendmentTracker(documentId)); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };

  return (
    <section className="rounded-2xl border border-[#8f1d2c]/8 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-[#8f1d2c]" />
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#514d46]">Amendment tracker</h3>
        </div>
        {!tracker && (
          <button type="button" onClick={load} disabled={loading || !documentId}
            className="rounded-lg bg-[#eee0dc] px-3 py-2 text-[10px] font-bold text-[#8f1d2c] disabled:opacity-45">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check versions"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-[#9a2637]">{error}</p>}
      {tracker && (
        <div className="mt-3 space-y-3 text-xs leading-5 text-[#625d55]">
          <p className="rounded-lg bg-[#f8f6f1] p-3">
            Status: <span className="font-semibold text-[#29312d]">{tracker.verificationStatus.replaceAll("_", " ")}</span>
          </p>
          {tracker.affectedSections?.length > 0 && (
            <div><p className="font-semibold text-[#29312d]">Affected sections</p><p>{tracker.affectedSections.join(", ")}</p></div>
          )}
          {tracker.timeline?.length > 0 && (
            <ol className="space-y-2 border-l border-[#8f1d2c]/15 pl-3">
              {tracker.timeline.map((event, index) => (
                <li key={`${event.documentId}-${event.kind}-${event.date}-${index}`}>
                  <span className="font-semibold text-[#29312d]">{event.title}</span><br />
                  {event.kind?.replaceAll("_", " ")} · {event.date || "date unverified"}
                </li>
              ))}
            </ol>
          )}
          {tracker.limitation && <p className="text-[#874047]">{tracker.limitation}</p>}
        </div>
      )}
    </section>
  );
}
