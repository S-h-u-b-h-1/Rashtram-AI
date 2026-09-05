"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, GitCompareArrows, Network, PanelRightClose, PenLine, Clock3, Loader2 } from "lucide-react";
import { DocumentSummaryPanel } from "./DocumentSummaryPanel";
import { DocumentTimeline } from "./DocumentTimeline";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { RelatedDocuments } from "./RelatedDocuments";
import { ResearchNotes } from "./ResearchNotes";
import { AmendmentTrackerPanel } from "./AmendmentTrackerPanel";
import { flattenResearchWorkflows } from "@/lib/research-workflows";
import { generateResearchReport, getDocumentComparisons, getPolicyDrafts, getResearchHistory } from "@/lib/api";
import { uniqueIds } from "@/lib/research-workspace.mjs";
import { isComparisonReady } from "@/lib/document-readiness";

const workflows = flattenResearchWorkflows();
const actionClass = "flex min-h-12 w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs font-medium text-[#514d46] transition hover:bg-[#eee0dc] disabled:cursor-not-allowed disabled:opacity-45";

export function StudioPanel({ document = {}, catalogueSources, summary, notes = [], onAddNote, onDeleteNote, disabled, onRunWorkflow, onCollapse, selectedSourceIds = [], messages = [], onFindCatalogue }) {
  const router = useRouter();
  const documents = catalogueSources || (document.id ? [document] : []);
  const documentIds = uniqueIds(documents.map((item) => item.id), 5);
  const sourceIds = uniqueIds(selectedSourceIds);
  const identity = `${documentIds.join(',')}|${sourceIds.join(',')}`;
  const [tool, setTool] = useState("");
  const [outputs, setOutputs] = useState([]);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [reportQuestion, setReportQuestion] = useState("");
  const canCompare = documents.length >= 2 && documents.every(isComparisonReady);
  const scopeParams = new URLSearchParams({ ids: documentIds.join(','), sources: sourceIds.join(',') });
  useEffect(() => {
    let active = true;
    const [catalogueKey, personalKey] = identity.split('|');
    const scopeDocuments = uniqueIds(catalogueKey), scopeSources = uniqueIds(personalKey);
    Promise.allSettled([getDocumentComparisons(), getPolicyDrafts(), getResearchHistory()]).then(([comparisons, drafts, history]) => {
      if (!active) return;
      const relevant = (item) => (item.documentIds || []).some((id) => scopeDocuments.includes(String(id))) || (item.sourceIds || []).some((id) => scopeSources.includes(String(id)));
      const items = [
        ...(comparisons.status === 'fulfilled' ? comparisons.value.comparisons || [] : []).filter(relevant).map((item) => ({ ...item, type: 'Comparison', href: `/app/compare?comparison=${item.id}&ids=${uniqueIds(item.documentIds, 5).join(',')}` })),
        ...(drafts.status === 'fulfilled' ? drafts.value.drafts || [] : []).filter(relevant).map((item) => ({ ...item, type: 'Policy draft', href: `/app/policy-drafter?draft=${item.id}` })),
        ...(history.status === 'fulfilled' ? history.value.reports || [] : []).filter(relevant).map((item) => ({ ...item, type: 'Research report', href: `/app/reports/${item.id}` })),
      ];
      setOutputs(items.sort((a, b) => (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0)));
      setHistoryError([comparisons, drafts, history].some((item) => item.status === 'rejected') ? 'Some saved outputs could not be loaded. Check My Research.' : '');
    });
    return () => { active = false; };
  }, [identity]);
  const runWorkflow = (workflow) => onRunWorkflow?.({ ...workflow, prompt: workflow.prompt(document) });
  const generatedMessages = messages.filter((message) => message.sender === 'assistant' && message.metadata?.workflowTitle && !message.isStreaming && !message.isError);
  return <section className="app-scrollbar h-full overflow-y-auto bg-[#f8f6f1]">
    <div className="flex items-center justify-between px-4 py-3"><h2 className="text-sm font-semibold text-[#29312d]">Studio</h2>{onCollapse && <button type="button" onClick={onCollapse} className="hidden h-11 w-11 place-items-center rounded-lg text-[#706a61] lg:grid" aria-label="Collapse research tools"><PanelRightClose className="h-4 w-4" /></button>}</div>
    <div className="px-3 pb-4">
      <h3 className="px-3 text-xs font-semibold text-[#706a61]">Create</h3>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <button type="button" disabled={disabled || !onRunWorkflow} className={actionClass} onClick={() => runWorkflow(workflows.find((item) => item.id === 'executive_brief'))}><FileText className="h-4 w-4 shrink-0 text-[#8f1d2c]" />Summary</button>
        <button type="button" disabled={disabled || !canCompare} title={canCompare ? 'Compare selected Library documents' : 'Select at least two comparison-ready Library documents'} className={actionClass} onClick={() => router.push(`/app/compare?ids=${documentIds.join(',')}`)}><GitCompareArrows className="h-4 w-4 shrink-0 text-[#8f1d2c]" />Comparison</button>
        <button type="button" disabled={disabled || !identity.replace('|', '')} onClick={() => router.push(`/app/policy-drafter?${scopeParams}`)} className={actionClass}><PenLine className="h-4 w-4 shrink-0 text-[#8f1d2c]" />Policy draft</button>
        <button type="button" disabled={disabled || !documentIds.length} className={actionClass} onClick={() => setTool(tool === 'report' ? '' : 'report')}><FileText className="h-4 w-4 shrink-0 text-[#8f1d2c]" />Research report</button>
        <button type="button" disabled={!document.id} className={actionClass} onClick={() => setTool(tool === 'timeline' ? '' : 'timeline')}><Clock3 className="h-4 w-4 shrink-0 text-[#8f1d2c]" />Timeline</button>
        {document.id ? <Link className={actionClass} href={`/app/graph/${document.id}`}><Network className="h-4 w-4 shrink-0 text-[#8f1d2c]" />Relationships</Link> : <button type="button" disabled className={actionClass}><Network className="h-4 w-4 shrink-0" />Relationships</button>}
      </div>
      {!canCompare && onFindCatalogue && <button type="button" disabled={disabled} onClick={onFindCatalogue} className="min-h-11 px-3 text-xs text-[#8f1d2c] underline">Add Library sources to compare</button>}
      {!documentIds.length && <p className="px-3 py-2 text-xs leading-5 text-[#706a61]">Research reports and relationship tools require a Library document. You can summarise or draft from your own sources.</p>}
      {tool === 'report' && <form className="mt-3 space-y-2 rounded-xl border border-[#8f1d2c]/15 p-3" onSubmit={async (event) => { event.preventDefault(); if (generating) return; setGenerating(true); setError(''); try { const response = await generateResearchReport({ researchQuestion: reportQuestion, documentIds }); router.push(`/app/reports/${response.report?.id || response.id}`); } catch (failure) { setError(failure.message || 'Could not create the report. Try again.'); } finally { setGenerating(false); } }}><label className="block text-xs font-medium">Report question<textarea value={reportQuestion} onChange={(event) => setReportQuestion(event.target.value)} rows={3} required minLength={8} maxLength={1600} placeholder="What should this report investigate?" className="mt-2 w-full rounded-lg border border-[#8f1d2c]/15 bg-white p-2 text-xs leading-5" /></label><p className="text-[11px] text-[#706a61]">Uses {documentIds.length} selected Library {documentIds.length === 1 ? 'document' : 'documents'}. Personal uploads are not included in this report tool.</p><button disabled={generating || reportQuestion.trim().length < 8} className="flex min-h-11 items-center gap-2 rounded-lg bg-[#8f1d2c] px-3 text-xs text-white disabled:opacity-50">{generating && <Loader2 className="h-4 w-4 animate-spin" />}{generating ? 'Creating report…' : 'Create report'}</button></form>}
      {error && <p role="alert" className="p-3 text-xs text-[#85434a]">{error}</p>}
      {tool === 'timeline' && <div className="mt-3"><DocumentTimeline events={document.timeline || []} />{!document.timeline?.length && <p className="p-3 text-xs text-[#706a61]">No verified timeline events are available for this document.</p>}<AmendmentTrackerPanel documentId={document.id} /></div>}
      <details className="mt-2"><summary className="cursor-pointer px-3 py-3 text-xs font-medium text-[#706a61]">More research tools</summary><div className="space-y-1">{workflows.filter((item) => item.id !== 'executive_brief').map((workflow) => <button type="button" key={workflow.id} disabled={disabled || !onRunWorkflow} onClick={() => runWorkflow(workflow)} className={actionClass}>{workflow.title}</button>)}<Link href="/app/recommend" className={actionClass}>Compliance research & tracking</Link></div></details>
      <div className="mt-5 border-t border-[#8f1d2c]/10 pt-5"><h3 className="px-3 text-xs font-semibold text-[#706a61]">Saved outputs</h3>
        {historyError && <p role="status" className="px-3 py-2 text-xs text-[#85434a]">{historyError}</p>}
        {!outputs.length && !generatedMessages.length && <p className="px-3 py-4 text-xs leading-6 text-[#706a61]">Create an output from your sources. Saved outputs will appear here.</p>}
        {generatedMessages.map((message, index) => <button key={message._id || message.id || index} type="button" onClick={() => { globalThis.document.getElementById(`research-message-${message._id || message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className={actionClass}>{message.metadata.workflowTitle}</button>)}
        {outputs.slice(0, 8).map((output) => <Link key={`${output.type}:${output.id}`} href={output.href} className="block rounded-lg px-3 py-3 hover:bg-[#f1ece3]"><span className="block text-xs font-medium leading-5">{output.title}</span><span className="mt-1 block text-[11px] text-[#706a61]">{output.type} · Related to these sources</span></Link>)}
        <Link href="/app/research" className="inline-flex min-h-11 items-center px-3 text-xs text-[#8f1d2c]">All saved research →</Link>
      </div>
      {summary && <details className="mt-4 border-t border-[#8f1d2c]/10"><summary className="cursor-pointer px-3 py-4 text-xs font-medium text-[#706a61]">Document overview</summary><DocumentSummaryPanel summary={summary} /></details>}
      {document.id && <details className="border-t border-[#8f1d2c]/10"><summary className="cursor-pointer px-3 py-4 text-xs font-medium text-[#706a61]">Related sources</summary><RelatedDocuments sourceDocument={document} sourceDocumentType={document.documentType || document.type} relationships={document.relationships} recommendations={document.recommendations} relatedChats={document.relatedChats} /><KnowledgeGraph graph={document.graph} /></details>}
      {onAddNote && <details className="border-t border-[#8f1d2c]/10"><summary className="cursor-pointer px-3 py-4 text-xs font-medium text-[#706a61]">Notes · {notes.length}</summary><ResearchNotes notes={notes} onAdd={onAddNote} onDelete={onDeleteNote} /></details>}
    </div>
  </section>;
}
