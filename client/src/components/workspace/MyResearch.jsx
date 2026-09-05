"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { formatDate } from "@/lib/document-links";
import { resumeChatHref, savedSearchHref, uniqueIds, workspaceHref } from "@/lib/research-workspace.mjs";

const TABS = ["Recent", "Saved", "Sources", "Outputs", "Monitoring"];
const LOADERS = { profile: api.getProfile, chats: () => api.getRecentDocumentChats(50), history: api.getResearchHistory, comparisons: api.getDocumentComparisons, drafts: api.getPolicyDrafts, sources: api.getResearchSources, watchlists: api.getRegulatoryWatchlists, alerts: api.getRegulatoryAlerts };

function ResearchRow({ title, href, date, count, kind, children }) {
  return <article className="flex flex-wrap items-center gap-3 border-b border-[#8f1d2c]/10 py-5">
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-6">{title || "Untitled research"}</p>
      <p className="mt-1 text-xs leading-5 text-[#706a61]">{[kind, Number.isFinite(count) ? `${count} ${count === 1 ? "source" : "sources"}` : null, formatDate(date, "")].filter(Boolean).join(" · ")}</p>{children}</div>
    {href && <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-[#8f1d2c] hover:bg-[#f1ece3]">{kind === "Conversation" ? "Resume research" : "Open"}<ArrowUpRight className="h-4 w-4" /></Link>}
  </article>;
}

export function MyResearch() {
  const { user } = useAuth();
  const owner = String(user?.id || user?._id || "");
  const [tab, setTab] = useState("Recent");
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ owner: "", data: {}, errors: [], loading: true });
  const [actionError, setActionError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.allSettled(Object.values(LOADERS).map((load) => load())).then((results) => {
      if (!active) return;
      const data = {}, errors = [];
      Object.keys(LOADERS).forEach((name, index) => {
        if (results[index].status === "fulfilled") data[name] = results[index].value;
        else errors.push(name);
      });
      setState({ owner, data, errors, loading: false });
    });
    return () => { active = false; };
  }, [owner, revision]);
  const { data, errors, loading } = state.owner === owner ? state : { data: {}, errors: [], loading: true };
  const account = data.profile?.account || {};
  const chats = [...new Map([...(data.chats?.chats || []), ...(data.history?.chats || [])]
    .map((chat) => ({ ...chat, href: resumeChatHref(chat) })).filter((chat) => chat.href).map((chat) => [chat.href, chat])).values()]
    .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  const outputs = [
    ...(data.comparisons?.comparisons || []).map((item) => ({ ...item, kind: "Comparison", href: `/app/compare?comparison=${encodeURIComponent(item.id)}&ids=${uniqueIds(item.documentIds, 5).join(',')}` })),
    ...(data.drafts?.drafts || []).map((item) => ({ ...item, kind: "Policy draft", href: `/app/policy-drafter?draft=${encodeURIComponent(item.id)}` })),
    ...(data.history?.reports || []).map((item) => ({ ...item, kind: "Research report", href: `/app/reports/${encodeURIComponent(item.id)}` })),
  ].sort((a, b) => (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0));
  const empty = <div className="py-12 text-center"><p className="text-base font-medium">Your saved research will appear here.</p><p className="mt-2 text-sm text-[#706a61]">Start a question, choose your sources and continue whenever you’re ready.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#8f1d2c] px-5 text-sm text-white" href="/app">New research</Link></div>;
  return <div className="mx-auto max-w-[1020px]">
    <div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-3xl">My research</h2><p className="mt-3 text-sm text-[#706a61]">Your conversations, sources and outputs, ready to continue.</p></div>
      <button type="button" onClick={() => { api.clearApiCache(); setRevision((value) => value + 1); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-[#f1ece3]" aria-label="Refresh saved research"><RefreshCw className="h-4 w-4" /></button></div>
    <div className="mt-7 flex flex-wrap gap-1 border-b border-[#8f1d2c]/10" aria-label="Research categories">{TABS.map((name) => <button type="button" key={name} aria-pressed={tab === name} onClick={() => setTab(name)} className={`min-h-11 rounded-t-lg px-4 text-sm ${tab === name ? "border-b-2 border-[#8f1d2c] font-semibold text-[#8f1d2c]" : "text-[#706a61] hover:bg-[#f1ece3]"}`}>{name}</button>)}</div>
    {errors.length > 0 && <p role="alert" className="my-4 rounded-lg bg-[#f4e4e0] p-3 text-sm text-[#85434a]">Some saved items could not be loaded ({errors.join(", ")}). Refresh to try again. Other items remain available.</p>}
    {loading ? <p role="status" className="py-10 text-sm text-[#706a61]">Loading your research…</p> : <>
      {tab === "Recent" && (chats.length ? chats.map((chat) => <ResearchRow key={chat.href} title={chat.title} href={chat.href} date={chat.updatedAt} kind="Conversation" count={chat.documentId ? 1 + uniqueIds(chat.messages?.findLast?.((message) => message.metadata?.sourceIds)?.metadata?.sourceIds || []).length : uniqueIds(chat.documentIds).length + uniqueIds(chat.sourceIds).length} />) : empty)}
      {tab === "Outputs" && <><div className="flex flex-wrap gap-3 py-4"><Link href="/app/policy-drafter" className="min-h-11 rounded-lg border border-[#8f1d2c]/15 px-4 py-3 text-xs text-[#8f1d2c]">Create policy draft</Link><Link href="/app/library" className="min-h-11 rounded-lg px-4 py-3 text-xs text-[#706a61]">Select sources for a comparison or report</Link></div>{outputs.length ? outputs.map((item) => <ResearchRow key={`${item.kind}:${item.id}`} title={item.title} href={item.href} kind={item.kind} date={item.updatedAt || item.createdAt} count={uniqueIds(item.documentIds).length + uniqueIds(item.sourceIds).length} />) : empty}</>}
      {tab === "Sources" && <><Link href="/app" className="my-4 inline-flex min-h-11 items-center rounded-lg border border-[#8f1d2c]/15 px-4 text-xs text-[#8f1d2c]">Add a PDF or link in New Research</Link>{data.sources?.sources?.length ? data.sources.sources.map((source) => <ResearchRow key={source.id} title={source.title} date={source.createdAt} kind={source.sourceType === "pdf_upload" ? "Your PDF" : "Your link"} count={1} href={source.status === "ready" ? workspaceHref({ sourceIds: [source.id] }) : undefined}><p className="mt-1 text-xs text-[#706a61]">{source.status === "ready" ? "Ready to research" : source.status === "failed" ? "Could not prepare this source. Retry from Sources." : "Preparing source…"}</p></ResearchRow>) : empty}</>}
      {tab === "Saved" && <>
        {(account.savedContent || []).map((item) => <ResearchRow key={`saved:${item.id}`} title={item.title} href={item.documentId ? `/app/document/${encodeURIComponent(item.documentId)}` : undefined} date={item.createdAt} kind="Saved document" count={1} />)}
        {(account.savedSearches || []).map((item) => <ResearchRow key={`search:${item.id}`} title={item.name || item.query} href={savedSearchHref(item)} date={item.updatedAt} kind="Saved search" />)}
        {(account.collections || []).map((collection) => <details key={collection.id} className="border-b border-[#8f1d2c]/10 py-4"><summary className="cursor-pointer py-2 text-sm font-semibold">{collection.name} · {collection.items.length} sources</summary>{collection.items.map((item) => <ResearchRow key={`${item.documentType}:${item.documentId}`} title={item.title} href={`/app/document/${encodeURIComponent(item.documentId)}`} kind="Collection source" />)}</details>)}
        {(account.notes || []).map((note) => <ResearchRow key={`note:${note.id}`} title={note.body} href={`/app/document/${encodeURIComponent(note.documentId)}`} date={note.updatedAt} kind="Research note" />)}
        {!['savedContent', 'savedSearches', 'collections', 'notes'].some((key) => account[key]?.length) && empty}
      </>}
      {tab === "Monitoring" && <><div className="flex flex-wrap gap-3 py-4"><Link href="/app/recommend" className="min-h-11 rounded-lg border border-[#8f1d2c]/15 px-4 py-3 text-xs text-[#8f1d2c]">Track a topic</Link><button type="button" disabled={refreshing} onClick={async () => { setRefreshing(true); setActionError(''); try { await api.refreshRegulatoryWatchlists(); api.clearApiCache(); setRevision((value) => value + 1); } catch (failure) { setActionError(failure.message); } finally { setRefreshing(false); } }} className="min-h-11 rounded-lg px-4 text-xs text-[#706a61] disabled:opacity-50">{refreshing ? "Checking updates…" : "Check for updates"}</button></div>
        {actionError && <p role="alert" className="text-sm text-[#85434a]">{actionError}</p>}
        {(data.watchlists?.watchlists || []).map((item) => <ResearchRow key={item.id} title={item.name || item.title || item.watchValue || item.problem} date={item.updatedAt || item.createdAt} kind="Watchlist" href="/app/recommend" />)}
        {(data.alerts?.alerts || []).map((item) => <ResearchRow key={`alert:${item.id}`} title={item.title || item.whyTriggered || item.explanation} date={item.createdAt} kind="Source update" href={item.documentId ? `/app/document/${encodeURIComponent(item.documentId)}` : undefined}><p className="mt-2 text-xs text-[#706a61]">{item.impactSummary || item.whyTriggered || item.explanation || item.reason}</p>{/^https?:\/\//.test(item.sourceUrl || '') && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center text-xs text-[#8f1d2c]">Inspect original source</a>}</ResearchRow>)}
        {!data.watchlists?.watchlists?.length && !data.alerts?.alerts?.length && <p className="py-8 text-sm text-[#706a61]">Track a research topic to see source-linked updates here.</p>}
      </>}
    </>}
  </div>;
}
