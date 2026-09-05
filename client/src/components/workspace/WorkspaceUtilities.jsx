"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getDashboardIntelligence, getProfile } from "@/lib/api";
import { AccountSettings } from "@/components/profile/AccountSettings";
import { ProfileSupportForms } from "@/components/profile/ProfileSupportForms";
import { SourceHealthPanel } from "@/components/intelligence/SourceHealthPanel";
import { PlatformCoverageOverview } from "@/components/intelligence/PlatformCoverageOverview";
import { useAuth } from "@/context/AuthContext";

export function WorkspaceUtilities({ mode }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState("details");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (mode === "help") return undefined;
    let active = true;
    (mode === "coverage" ? getDashboardIntelligence() : getProfile())
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch(() => { if (active) setError("We could not load this page. Try again."); });
    return () => { active = false; };
  }, [mode, revision]);
  if (mode === "help") return <div className="mx-auto max-w-3xl"><h2 className="font-serif text-3xl">Research, one step at a time</h2><ol className="my-6 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#514d46]"><li>Start a question in <Link href="/app" className="text-[#8f1d2c] underline">New Research</Link>, or find an instrument in <Link href="/app/library" className="text-[#8f1d2c] underline">Library</Link>.</li><li>Preview and select the sources you want to use. Uploaded PDFs and links stay associated with your account.</li><li>Ask questions in Chat. Open cited passages to check the evidence.</li><li>Create summaries, comparisons, policy drafts and research reports in Studio.</li><li>Return to <Link href="/app/research" className="text-[#8f1d2c] underline">My Research</Link> to resume saved conversations and outputs.</li></ol><p className="mb-8 text-sm leading-6 text-[#706a61]">A source’s publication date does not establish that a legal position is current. Check freshness and evidence limitations in the answer and original record.</p><ProfileSupportForms defaultEmail={user?.email || ''} /></div>;
  if (error) return <div role="alert" className="p-6 text-sm text-[#85434a]">{error}<button type="button" onClick={() => setRevision((value) => value + 1)} className="ml-3 min-h-11 underline">Try again</button></div>;
  if (!data) return <p role="status" className="py-8 text-sm text-[#706a61]">Loading {mode === "coverage" ? "source coverage" : "account settings"}…</p>;
  if (mode === "coverage") return <div className="space-y-6"><div><h2 className="font-serif text-3xl">Coverage & Sources</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-[#706a61]">Coverage varies by source. An indexed record does not guarantee complete or current legal coverage. Check the dates and authority of the sources used in each answer.</p></div><SourceHealthPanel sources={data.sourceHealth || []} /><details><summary className="cursor-pointer py-4 text-sm font-semibold">Collection coverage details</summary><PlatformCoverageOverview coverage={data.platformCoverage || {}} /></details></div>;
  return <div className="mx-auto max-w-5xl"><AccountSettings account={data.account} user={data.user} activePanel={panel} onPanelChange={setPanel} onUpdate={(updates) => setData((current) => ({ ...current, account: { ...current.account, ...updates } }))} /></div>;
}
