"use client";

import Link from "next/link";
import { ArrowRight, FileText, Link2, Loader2, Search, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { addResearchPdfSource, addResearchUrlSource, deleteResearchSource, fetchDocuments, getResearchSources, retryResearchPdfSource } from "@/lib/api";
import { isResearchReady } from "@/lib/document-readiness";
import { formatDate, humanize } from "@/lib/document-links";
import { selectedPersonalSources, workspaceHref } from "@/lib/research-workspace.mjs";
import { StudySourcesPanel } from "@/components/document-chat/StudySourcesPanel";
import { RecentResearch } from "./RecentResearch";
import { useRecentResearch } from "@/hooks/useRecentResearch";

const EXAMPLES = [
  "What are the current RBI requirements for digital lending?",
  "Compare the DPDP Act with the earlier Bill.",
  "What compliance applies to battery recycling in Gujarat?",
  "Create a university AI usage policy from selected sources.",
];

export function NewResearch() {
  const router = useRouter();
  const { user } = useAuth();
  const { items: recent, loading: recentLoading } = useRecentResearch(4);
  const [question, setQuestion] = useState("");
  const [searchedQuestion, setSearchedQuestion] = useState("");
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState([]);
  const [sources, setSources] = useState([]);
  const [sourceIds, setSourceIds] = useState([]);
  const [showSources, setShowSources] = useState(false);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState("");
  const [sourceError, setSourceError] = useState("");
  const requestRef = useRef(null);
  const owner = user?.id || user?._id;

  useEffect(() => {
    let active = true;
    getResearchSources().then((result) => { if (active) { setSources(result.sources || []); setSourceIds([]); } })
      .catch(() => { if (active) setSourceError("Your saved sources could not be loaded. You can still find documents in Library."); });
    return () => { active = false; requestRef.current?.abort(); };
  }, [owner]);

  const discover = async (event) => {
    event.preventDefault();
    const query = question.trim();
    if (query.length < 3) { setError("Enter a topic or research question to find sources."); return; }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setFinding(true); setError(""); setDocuments([]); setSelected([]); setSearchedQuestion(query);
    try {
      const result = await fetchDocuments({ search: query, semantic: true, researchReady: true, sortBy: "relevance", limit: 12, signal: controller.signal });
      if (!controller.signal.aborted) setDocuments((result.documents || []).filter(isResearchReady));
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || "We could not find sources. Try again or search the Library.");
    } finally { if (!controller.signal.aborted) setFinding(false); }
  };
  const toggleDocument = (id) => setSelected((current) => current.includes(String(id)) ? current.filter((item) => item !== String(id)) : [...current, String(id)].slice(0, 5));
  const toggleSource = (id) => setSourceIds((current) => current.includes(String(id)) ? current.filter((item) => item !== String(id)) : [...current, String(id)].slice(0, 20));
  const addSource = (source) => {
    setSources((current) => [source, ...current.filter((item) => String(item.id) !== String(source.id))]);
    if (source.status === "ready") setSourceIds((current) => [...new Set([...current, String(source.id)])].slice(0, 20));
  };
  const readySourceIds = selectedPersonalSources(sources, sourceIds).map((source) => String(source.id));
  const count = selected.length + readySourceIds.length;

  return <div className={`mx-auto max-w-[840px] ${searchedQuestion || showSources ? "pt-2" : "pt-[clamp(1rem,9vh,6rem)]"}`}>
    <h2 className="text-balance text-center font-serif text-[clamp(1.8rem,3.3vw,2.7rem)] leading-tight text-[#29312d]">What are you researching today?</h2>
    <p className="mt-4 text-center text-sm leading-6 text-[#706a61]">Search Indian laws, regulations and policies, or add your own sources.</p>
    <form onSubmit={discover} className="mt-7 rounded-2xl border border-[#8f1d2c]/20 bg-white p-3 shadow-[0_4px_20px_rgba(143,29,44,0.035)] focus-within:ring-2 focus-within:ring-[#8f1d2c]/20">
      <label htmlFor="research-question" className="sr-only">Research question</label>
      <textarea id="research-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1600} rows={3} placeholder="Ask a research question…" className="w-full resize-none bg-transparent px-2 py-2 text-base leading-7 outline-none placeholder:text-[#8a8277]"
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setShowSources((value) => !value)} aria-expanded={showSources} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs text-[#706a61] hover:bg-[#f1ece3]"><Upload className="h-4 w-4" />PDF <span aria-hidden="true">/</span><Link2 className="h-4 w-4" />Link</button>
          <Link href="/app/library" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs text-[#706a61] hover:bg-[#f1ece3]"><Search className="h-4 w-4" /><span>Library</span></Link>
        </div>
        <button type="submit" disabled={finding || question.trim().length < 3} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#8f1d2c] px-4 text-sm font-semibold text-white disabled:opacity-50">{finding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Find sources</button>
      </div>
    </form>
    <p className="mt-3 text-center text-xs text-[#706a61]">Choose your sources before Rashtram answers. Your research stays private to your account.</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-[#f4e4e0] p-3 text-sm text-[#85434a]">{error}</p>}
    {showSources && <section className="mt-5 overflow-hidden rounded-xl border border-[#8f1d2c]/15">
      <div className="flex items-center justify-between px-4 py-2"><h3 className="text-sm font-semibold">Add your sources</h3><button type="button" onClick={() => setShowSources(false)} className="grid h-11 w-11 place-items-center" aria-label="Close source picker"><X className="h-4 w-4" /></button></div>
      {sourceError && <p role="alert" className="px-4 text-sm text-[#85434a]">{sourceError}</p>}
      <div className="max-h-[520px] overflow-y-auto"><StudySourcesPanel sources={sources} selectedIds={sourceIds} onToggle={toggleSource}
        onAddUrl={async (url) => addSource((await addResearchUrlSource(url)).source)} onAddPdf={async (file, options) => addSource((await addResearchPdfSource(file, options)).source)}
        onRetry={async (id) => addSource((await retryResearchPdfSource(id)).source)}
        onDelete={async (id) => { await deleteResearchSource(id); setSources((current) => current.filter((item) => String(item.id) !== String(id))); setSourceIds((current) => current.filter((item) => item !== String(id))); }} /></div>
    </section>}
    {finding && <p role="status" className="py-8 text-center text-sm text-[#706a61]">Finding relevant sources…</p>}
    {searchedQuestion && !finding && !error && <section className="mt-7" aria-label="Choose research sources">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-base font-semibold">{documents.length ? `${documents.length} sources to review` : "No ready sources found for this question"}</h3><p className="text-xs text-[#706a61]">Select up to 5 Library documents</p></div>
      {!documents.length && <p className="mt-3 text-sm leading-6 text-[#706a61]">Try the instrument name or a shorter topic. You can also add a PDF or link, or <Link className="text-[#8f1d2c] underline" href={`/app/library?q=${encodeURIComponent(searchedQuestion)}`}>browse Library</Link>. No answer has been generated.</p>}
      <div className="mt-3 divide-y divide-[#8f1d2c]/10">{documents.map((document) => { const checked = selected.includes(String(document.id)); return <article key={document.id} className={`py-4 ${checked ? "bg-[#f1ece3]" : ""}`}>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg px-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#8f1d2c]" checked={checked} disabled={!checked && selected.length >= 5} onChange={() => toggleDocument(document.id)} />
          <span className="min-w-0"><span className="block text-sm font-semibold leading-6">{document.title}</span><span className="mt-1 block text-xs leading-5 text-[#706a61]">{[humanize(document.type || document.documentType), document.authority || document.ministry, document.jurisdiction || document.state, formatDate(document.publicationDate, document.year || "Date unavailable")].filter(Boolean).join(" · ")}</span>
          <span className="mt-2 block text-xs leading-5 text-[#706a61]">{document.relevanceExplanation || document.matchExplanation || "Matched by Library search. Review the source before including it."}</span><span className="mt-2 block text-xs font-medium text-[#34725b]">Ready to research</span></span>
        </label>
        <div className="pl-11 pt-1">{(document.sourceUrl || document.pdfUrl) && <a href={document.sourceUrl || document.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-xs text-[#8f1d2c]"><FileText className="h-3.5 w-3.5" />Preview source</a>}</div>
      </article>; })}</div>
    </section>}
    {count > 0 && <div className="sticky bottom-0 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8f1d2c]/15 bg-[#f8f6f1] p-4 shadow-sm">
      <p className="text-sm">{count} {count === 1 ? "source" : "sources"} selected</p>
      <button type="button" onClick={() => router.push(workspaceHref({ documentIds: selected, sourceIds: readySourceIds, question }))} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#8f1d2c] px-4 text-sm font-semibold text-white">Start research with these sources<ArrowRight className="h-4 w-4" /></button>
    </div>}
    {!searchedQuestion && !showSources && !recentLoading && !recent.length && <section aria-label="Example research questions" className="mt-8 grid gap-2 sm:grid-cols-2">{EXAMPLES.map((example) => <button key={example} type="button" onClick={() => { setQuestion(example); document.getElementById("research-question")?.focus(); }} className="rounded-xl px-4 py-3 text-left text-xs leading-5 text-[#706a61] transition hover:bg-[#f1ece3]">{example}<ArrowRight className="ml-2 inline h-3 w-3 text-[#8f1d2c]" /></button>)}</section>}
    {!searchedQuestion && <RecentResearch />}
  </div>;
}
