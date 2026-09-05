"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, PanelLeftOpen, PanelRightOpen, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchDocument, getResearchSources, addResearchUrlSource, addResearchPdfSource, deleteResearchSource, retryResearchPdfSource, clearCrossDocumentChatHistory, getCrossDocumentChatHistory, getDocumentReadiness, prepareDocumentForComparison, sendCrossDocumentChat } from "@/lib/api";
import { ChatHistory } from "@/components/document-chat/ChatHistory";
import { ChatInput } from "@/components/document-chat/ChatInput";
import { useSmoothMessageStream } from "@/hooks/useSmoothMessageStream";
import { usePinnedChatScroll } from "@/hooks/usePinnedChatScroll";
import { StudySourcesPanel } from "@/components/document-chat/StudySourcesPanel";
import { StudioPanel } from "@/components/document-chat/StudioPanel";
import { MobileWorkspaceSheet } from "@/components/workspace/MobileWorkspaceSheet";
import { CatalogueSourcePicker } from "@/components/workspace/CatalogueSourcePicker";
import { restoreSourceIds, selectedPersonalSources, sourceCount, workspaceHref, uniqueIds } from "@/lib/research-workspace.mjs";

const EMPTY_IDS = [];
export function MultiDocumentChat({ documentIds, comparisonId = null, draftQuestion = null, initialSourceIds = EMPTY_IDS }) {
  const router = useRouter();
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(draftQuestion?.text || "");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [responseLanguage, setResponseLanguage] = useState("Auto");
  const [studySources, setStudySources] = useState([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [studioOpen, setStudioOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const abortControllerRef = useRef(null);
  const sendingRef = useRef(false);
  const smoothStream = useSmoothMessageStream(setMessages);
  const { handleScroll, messagesEndRef, pinToLatest, scrollContainerRef } = usePinnedChatScroll(messages);
  const identity = `${documentIds.join(',')}|${initialSourceIds.join(',')}`;
  useEffect(() => { if (draftQuestion?.text) setInput(draftQuestion.text); }, [draftQuestion?.text]);
  useEffect(() => {
    let active = true;
    const [documentKey, sourceKey] = identity.split('|');
    const loadDocumentIds = uniqueIds(documentKey, 5), loadSourceIds = uniqueIds(sourceKey);
    setLoading(true); setError(""); setMessages([]);
    Promise.all([Promise.all(loadDocumentIds.map(fetchDocument)), getCrossDocumentChatHistory(loadDocumentIds, loadSourceIds), getResearchSources()])
      .then(async ([responses, history, sourceResponse]) => {
        const loadedDocuments = responses.map((response) => response.document);
        if (!active) return;
        setDocuments(loadedDocuments); setMessages(history.messages || []); setStudySources(sourceResponse.sources || []);
        const restored = history.messages?.length ? restoreSourceIds(history.messages, sourceResponse.sources) : loadSourceIds;
        setSelectedSourceIds(selectedPersonalSources(sourceResponse.sources || [], restored).map((source) => String(source.id)));
        const results = await Promise.allSettled(loadedDocuments.map(async (document) => {
          const readiness = await getDocumentReadiness(document.id);
          if (readiness.comparisonReady) return readiness;
          if (!readiness.canPrepare) throw new Error(readiness.reason || "This source is not ready to research.");
          const prepared = await prepareDocumentForComparison(document.id);
          const finalReadiness = prepared.readiness || await getDocumentReadiness(document.id);
          if (!finalReadiness.comparisonReady) throw new Error(finalReadiness.reason || "This source could not be prepared.");
          return finalReadiness;
        }));
        if (!active) return;
        const failed = results.find((result) => result.status === "rejected");
        setDocuments(loadedDocuments.map((document, index) => ({ ...document, researchReady: results[index].status === 'fulfilled', comparisonReady: results[index].status === 'fulfilled', capabilities: { ...document.capabilities, chatReady: results[index].status === 'fulfilled', comparisonReady: results[index].status === 'fulfilled' } })));
        if (failed) setError(failed.reason?.message || "A selected source is unavailable. Review your source selection.");
      }).catch((failure) => { if (active) setError(failure.message || "We could not load this research workspace. Try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; abortControllerRef.current?.abort(); };
  }, [identity, revision]);

  const count = sourceCount(documents, studySources, selectedSourceIds);
  const submit = async (question = input, options = {}) => {
    const text = String(question || '').trim();
    if (!text || sendingRef.current || !count) return;
    sendingRef.current = true;
    const streamId = `cross-${globalThis.crypto.randomUUID()}`;
    const controller = new AbortController(); abortControllerRef.current = controller;
    smoothStream.start(streamId); pinToLatest(); setInput(''); setSending(true); setError('');
    const timestamp = new Date().toISOString();
    setMessages((current) => [...current, { id: `${streamId}:user`, sender: 'user', text, timestamp, metadata: { sourceIds: selectedSourceIds } }, { id: streamId, sender: 'assistant', text: '', timestamp, isStreaming: true }]);
    try {
      const result = await sendCrossDocumentChat({ message: text, documentIds: documents.map((document) => document.id), sourceIds: selectedSourceIds, historySourceIds: initialSourceIds, comparisonId, responseLanguage, workflow: options.workflow, signal: controller.signal, onChunk: (chunk) => smoothStream.append(streamId, chunk) });
      smoothStream.complete(streamId, { ...result, metadata: { ...result.metadata, sourceIds: selectedSourceIds, ...(options.workflow ? { workflowTitle: options.workflow.title, workflowId: options.workflow.id } : {}) } });
    } catch (failure) {
      const stopped = controller.signal.aborted || failure.name === 'AbortError';
      smoothStream.fail(streamId, { stopped });
      if (!stopped) setError(failure.message || 'Response generation was interrupted. Please try again.');
    } finally { if (abortControllerRef.current === controller) abortControllerRef.current = null; setSending(false); sendingRef.current = false; }
  };
  const clear = async () => {
    if (sendingRef.current) return;
    try { await clearCrossDocumentChatHistory(documentIds, initialSourceIds); setMessages([]); }
    catch (failure) { setError(failure.message || 'We could not clear this conversation. Try again.'); }
  };
  const addSource = (source) => {
    setStudySources((current) => [source, ...current.filter((item) => String(item.id) !== String(source.id))]);
    if (source.status === 'ready') setSelectedSourceIds((current) => [...new Set([...current, String(source.id)])].slice(0, 20));
  };
  const toggleStudySource = (id) => setSelectedSourceIds((current) => current.includes(String(id)) ? current.filter((item) => item !== String(id)) : [...current, String(id)].slice(0, 20));
  const removeStudySource = async (id) => { await deleteResearchSource(id); setStudySources((current) => current.filter((source) => String(source.id) !== String(id))); setSelectedSourceIds((current) => current.filter((item) => item !== String(id))); };
  const switchSources = (next) => router.push(workspaceHref({ documentIds: next.map((item) => item.id), sourceIds: selectedSourceIds, question: input }));
  const sourcePanel = <StudySourcesPanel sources={studySources} catalogueSources={documents} selectedIds={selectedSourceIds} disabled={sending} onToggle={toggleStudySource} onAddUrl={async (url) => addSource((await addResearchUrlSource(url)).source)} onAddPdf={async (file, options) => addSource((await addResearchPdfSource(file, options)).source)} onRetry={async (id) => addSource((await retryResearchPdfSource(id)).source)} onDelete={removeStudySource} onFindCatalogue={() => { setMobilePanel(null); setPickerOpen(true); }} onRemoveCatalogue={(id) => switchSources(documents.filter((item) => String(item.id) !== String(id)))} onCollapse={() => setSourcesOpen(false)} />;
  const studioPanel = <StudioPanel document={documents[0] || { title: 'Selected personal sources' }} catalogueSources={documents} selectedSourceIds={selectedSourceIds} messages={messages} disabled={sending || !count} onFindCatalogue={() => { setMobilePanel(null); setPickerOpen(true); }} onRunWorkflow={(workflow) => { setMobilePanel(null); submit(workflow.prompt, { workflow }); }} onCollapse={() => setStudioOpen(false)} />;
  return <section className="fixed inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#f8f6f1] text-[#29312d]">
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#8f1d2c]/10 px-4"><Link href="/app" aria-label="Back to New Research" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#8f1d2c]"><ArrowLeft className="h-5 w-5" /></Link><h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{documents.length ? 'Research workspace' : 'Research your sources'}</h1><Link href="/app/research" className="flex min-h-11 items-center text-xs text-[#8f1d2c]">My Research</Link></header>
    <div role="navigation" aria-label="Workspace panels" className="flex shrink-0 border-b border-[#8f1d2c]/10 lg:hidden"><button type="button" onClick={() => setMobilePanel('sources')} className="min-h-11 flex-1 text-sm">Sources</button><button type="button" aria-pressed={!mobilePanel} onClick={() => setMobilePanel(null)} className="min-h-11 flex-1 border-b-2 border-[#8f1d2c] text-sm font-semibold text-[#8f1d2c]">Chat</button><button type="button" onClick={() => setMobilePanel('studio')} className="min-h-11 flex-1 text-sm">Studio</button></div>
    {loading ? <div role="status" className="grid flex-1 place-items-center text-sm text-[#706a61]"><span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Opening research workspace…</span></div> : <div className={`grid min-h-0 flex-1 ${sourcesOpen && studioOpen ? 'lg:grid-cols-[minmax(230px,21%)_minmax(0,1fr)_minmax(250px,23%)]' : sourcesOpen ? 'lg:grid-cols-[260px_minmax(0,1fr)]' : studioOpen ? 'lg:grid-cols-[minmax(0,1fr)_280px]' : 'lg:grid-cols-1'}`}>
      {sourcesOpen && <aside aria-label="Workspace side panel" className="hidden min-h-0 overflow-hidden border-r border-[#8f1d2c]/10 lg:block">{sourcePanel}</aside>}
      <main className="flex min-h-0 min-w-0 flex-col"><div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-[#8f1d2c]/10 px-4"><h2 className="text-sm font-semibold">Chat</h2><div className="flex items-center gap-2"><span className="text-xs text-[#706a61]">Sources · {count}</span>{!sourcesOpen && <button type="button" onClick={() => setSourcesOpen(true)} className="hidden h-11 w-11 place-items-center lg:grid" aria-label="Expand sources"><PanelLeftOpen className="h-4 w-4" /></button>}{!studioOpen && <button type="button" onClick={() => setStudioOpen(true)} className="hidden h-11 w-11 place-items-center lg:grid" aria-label="Expand Studio"><PanelRightOpen className="h-4 w-4" /></button>}</div></div>
        {error && <div role="alert" className="bg-[#f4e4e0] px-4 py-3 text-xs leading-5 text-[#85434a]">{error} <button type="button" disabled={sending} onClick={() => setRevision((value) => value + 1)} className="min-h-11 px-2 underline">Reload workspace</button></div>}
        <div ref={scrollContainerRef} onScroll={handleScroll} tabIndex={0} aria-label="Research conversation" className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{!messages.length && <p className="mx-auto max-w-xl py-8 text-center text-sm leading-7 text-[#706a61]">{count ? 'Your sources are selected. Ask a question to start a cited conversation.' : 'Add a ready PDF, link or Library document to begin.'}</p>}<ChatHistory messages={messages} messagesEndRef={messagesEndRef} onFeedback={async () => {}} /></div>
        <ChatInput input={input} setInput={setInput} sending={sending} disabled={!count} onSend={() => submit()} onStop={() => abortControllerRef.current?.abort()} onRegenerate={() => { const last = [...messages].reverse().find((message) => message.sender === 'user'); if (last) submit(last.text); }} onClear={clear} responseLanguage={responseLanguage} onResponseLanguageChange={setResponseLanguage} />
      </main>
      {studioOpen && <aside aria-label="Workspace side panel" className="hidden min-h-0 overflow-hidden border-l border-[#8f1d2c]/10 lg:block">{studioPanel}</aside>}
    </div>}
    <MobileWorkspaceSheet open={Boolean(mobilePanel)} title={mobilePanel === 'sources' ? 'Sources' : 'Studio'} onClose={() => setMobilePanel(null)}>{mobilePanel === 'sources' ? sourcePanel : studioPanel}</MobileWorkspaceSheet>
    <CatalogueSourcePicker open={pickerOpen} onOpenChange={setPickerOpen} documents={documents} onConfirm={switchSources} />
  </section>;
}
