"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  Check,
  Download,
  FileText,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addResearchPdfSource,
  addResearchUrlSource,
  createPolicyDraft,
  deleteResearchSource,
  downloadPolicyDraftDocx,
  getResearchSources,
  recommendForProblem,
} from "@/lib/api";
import { StudySourcesPanel } from "@/components/document-chat/StudySourcesPanel";
import { MobileWorkspaceSheet } from "@/components/workspace/MobileWorkspaceSheet";

const fieldClass =
  "w-full rounded-xl border border-[#8f1d2c]/12 bg-white px-3 py-2.5 text-sm text-[#29312d] outline-none transition focus:border-[#8f1d2c]/45 focus:ring-2 focus:ring-[#8f1d2c]/10";

export function PolicyDraftWorkspace() {
  const [sources, setSources] = useState([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [brief, setBrief] = useState({
    title: "",
    objective: "",
    audience: "",
    geography: "India",
    requirements: "",
  });
  const [draft, setDraft] = useState("");
  const [draftId, setDraftId] = useState(null);
  const [citations, setCitations] = useState([]);
  const [drafting, setDrafting] = useState(false);
  const [draftingStage, setDraftingStage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState(null);

  useEffect(() => {
    let active = true;
    getResearchSources().catch(() => ({ sources: [] })).then((sourceResponse) => {
      if (!active) return;
      setSources(sourceResponse.sources || []);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const objective = brief.objective.trim();
    if (objective.length < 12) {
      setDocuments([]);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await recommendForProblem({
          problem: [objective, brief.audience, brief.geography, brief.requirements]
            .filter(Boolean)
            .join(". "),
          documentTypes: ["policy", "report", "act", "bill", "gazette"],
          limit: 12,
          draftOnly: true,
        });
        if (!active) return;
        const candidates = response.recommendations || [];
        setDocuments(candidates.filter((candidate, index, all) =>
          candidate.draftUsable &&
          all.findIndex((item) => String(item.id) === String(candidate.id)) === index,
        ));
        setSelectedDocumentIds((current) => current.filter((id) =>
          candidates.some((candidate) => candidate.draftUsable && String(candidate.id) === id),
        ));
      } catch {
        if (active) setDocuments([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 650);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [brief.objective, brief.audience, brief.geography, brief.requirements]);

  const filteredDocuments = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((document) =>
      [document.title, document.ministry, document.authority, document.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [documents, libraryQuery]);

  const updateBrief = (key, value) => setBrief((current) => ({ ...current, [key]: value }));
  const toggleDocument = (id) => setSelectedDocumentIds((current) =>
    current.includes(String(id)) ? current.filter((item) => item !== String(id)) : [...current, String(id)].slice(0, 8),
  );
  const toggleSource = (id) => setSelectedSourceIds((current) =>
    current.includes(String(id)) ? current.filter((item) => item !== String(id)) : [...current, String(id)].slice(0, 20),
  );
  const addSource = (source) => {
    setSources((current) => [source, ...current.filter((item) => String(item.id) !== String(source.id))]);
    setSelectedSourceIds((current) => current.includes(String(source.id)) ? current : [...current, String(source.id)]);
  };

  const handleDraft = async (event) => {
    event.preventDefault();
    if (drafting || !brief.objective.trim()) return;
    if (!selectedDocumentIds.length && !selectedSourceIds.length) {
      setError("Choose at least one catalogue document or study source first.");
      return;
    }
    setDrafting(true);
    setDraftingStage("Preparing evidence…");
    setDraft("");
    setDraftId(null);
    setCitations([]);
    setError("");
    try {
      const selectedDocuments = documents.filter((document) =>
        selectedDocumentIds.includes(String(document.id)),
      );
      if (selectedDocuments.length !== selectedDocumentIds.length ||
          selectedDocuments.some((document) => !document.draftUsable)) {
        throw new Error("A selected reference is no longer ready to use. Refresh the list and choose another document.");
      }
      const result = await createPolicyDraft({
        ...brief,
        documentIds: selectedDocumentIds,
        sourceIds: selectedSourceIds,
        onMeta: (meta) => setCitations(meta.citations || []),
        onStatus: (event) => setDraftingStage(event.status || "Writing your policy draft…"),
        onChunk: (chunk) => setDraft((current) => current + chunk),
      });
      if (result.draftText) setDraft(result.draftText);
      if (result.draftId) setDraftId(result.draftId);
    } catch (requestError) {
      setError(requestError.message || "The policy draft could not be generated.");
    } finally {
      setDrafting(false);
      setDraftingStage("");
    }
  };

  const downloadDraft = () => {
    if (!draft) return;
    const blob = new Blob([draft], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const fileName = (brief.title || "rashtram-policy-draft")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    anchor.href = url;
    anchor.download = `${fileName || "rashtram-policy-draft"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadDocx = async () => {
    if (!draftId) return;
    setError("");
    try {
      const { blob, fileName } = await downloadPolicyDraftDocx(draftId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message || "The Word document could not be downloaded.");
    }
  };

  const libraryPanel = (
    <section className="flex h-full min-h-0 flex-col bg-[#f8f6f1]">
      <div className="border-b border-[#8f1d2c]/10 px-4 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">Rashtram library</p>
        <h2 className="mt-1 text-lg font-semibold text-[#29312d]">Policy references</h2>
        <p className="mt-2 text-[11px] leading-5 text-[#706a61]">References are matched to the problem, audience, and jurisdiction in your draft brief.</p>
        <label className="mt-4 flex items-center gap-2 rounded-xl border border-[#8f1d2c]/12 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-[#8f1d2c]" />
          <input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search policy references" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#a79e91]" />
        </label>
      </div>
      <div className="app-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {loading ? <div className="flex items-center justify-center py-10 text-xs text-[#8a8277]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading references</div> : null}
        {!loading && !filteredDocuments.length ? <div className="rounded-2xl border border-dashed border-[#8f1d2c]/15 bg-white px-4 py-8 text-center text-xs leading-5 text-[#8a8277]">{brief.objective.trim().length < 12 ? "Describe the policy problem to see relevant references." : "No strongly related references were found. Add the sector, audience, or jurisdiction to the policy problem."}</div> : null}
        {filteredDocuments.map((document) => {
          const selected = selectedDocumentIds.includes(String(document.id));
          return <button key={document.id} type="button" onClick={() => toggleDocument(document.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selected ? "border-[#8f1d2c]/35 bg-[#fffaf0] shadow-sm" : "border-[#8f1d2c]/8 bg-white hover:border-[#8f1d2c]/20"}`}>
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${selected ? "border-[#8f1d2c] bg-[#8f1d2c] text-white" : "border-[#b8afa2] text-transparent"}`}><Check className="h-3 w-3" /></span>
              <span className="min-w-0 flex-1"><span className="line-clamp-3 block text-xs font-semibold leading-5 text-[#29312d]">{document.title}</span><span className="mt-1 block text-[10px] uppercase tracking-[0.1em] text-[#8a8277]">{document.type} · {document.ministry || document.authority || "India"}</span><span className="mt-1 block text-[10px] font-semibold text-[#34725b]">Ready to use</span></span>
            </div>
          </button>;
        })}
      </div>
      <div className="border-t border-[#8f1d2c]/10 px-4 py-3 text-[10px] text-[#706a61]">{selectedDocumentIds.length} catalogue references selected</div>
    </section>
  );

  return <div className={`grid min-h-[calc(100dvh-8rem)] overflow-hidden rounded-[1.5rem] border border-[#8f1d2c]/10 bg-[#f7f2eb] shadow-sm ${sourcesOpen && libraryOpen ? "lg:grid-cols-[280px_minmax(0,1fr)_320px]" : sourcesOpen ? "lg:grid-cols-[280px_minmax(0,1fr)]" : libraryOpen ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-1"}`}>
    {sourcesOpen && <aside className="hidden min-h-0 overflow-hidden border-r border-[#8f1d2c]/10 lg:block"><StudySourcesPanel sources={sources} selectedIds={selectedSourceIds} onToggle={toggleSource} onAddUrl={async (url) => addSource((await addResearchUrlSource(url)).source)} onAddPdf={async (file, options) => addSource((await addResearchPdfSource(file, options)).source)} onDelete={async (id) => { await deleteResearchSource(id); setSources((current) => current.filter((source) => String(source.id) !== String(id))); setSelectedSourceIds((current) => current.filter((sourceId) => sourceId !== String(id))); }} /></aside>}
    <main className="app-scrollbar min-h-0 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#8f1d2c] text-white"><PenLine className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">Policy drafting studio</p><h1 className="mt-1 font-serif text-2xl text-[#8f1d2c] sm:text-3xl">Draft from evidence, not a blank page</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#706a61]">Bring together Rashtram documents, public research, and your own PDFs or links. The draft keeps evidence and recommendations clearly separated.</p></div><div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => setMobilePanel("sources")} className="grid h-10 w-10 place-items-center rounded-xl border border-[#8f1d2c]/12 bg-white text-[#874047] lg:hidden" aria-label="Open websites and PDFs"><PanelLeftOpen className="h-4 w-4" /></button><button type="button" onClick={() => setMobilePanel("library")} className="grid h-10 w-10 place-items-center rounded-xl border border-[#8f1d2c]/12 bg-white text-[#874047] lg:hidden" aria-label="Open policy references"><PanelRightOpen className="h-4 w-4" /></button><div className="hidden items-center gap-1.5 lg:flex"><button type="button" onClick={() => setSourcesOpen((open) => !open)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#8f1d2c]/12 bg-white text-[#874047] transition hover:bg-[#eee0dc]" aria-label={sourcesOpen ? "Collapse sources" : "Expand sources"} title={sourcesOpen ? "Collapse sources" : "Expand sources"}>{sourcesOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}</button><button type="button" onClick={() => setLibraryOpen((open) => !open)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#8f1d2c]/12 bg-white text-[#874047] transition hover:bg-[#eee0dc]" aria-label={libraryOpen ? "Collapse policy references" : "Expand policy references"} title={libraryOpen ? "Collapse policy references" : "Expand policy references"}>{libraryOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}</button></div></div></div>
        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold text-[#874047]"><span className="rounded-full bg-[#eee0dc] px-3 py-1.5">{selectedDocumentIds.length + selectedSourceIds.length} sources selected</span><span className="rounded-full bg-[#e9eee7] px-3 py-1.5">Citations retained</span><span className="rounded-full bg-[#eee7f3] px-3 py-1.5">Government and independent research labelled</span></div>
        <form onSubmit={handleDraft} className="mt-6 space-y-4 rounded-3xl border border-[#8f1d2c]/10 bg-white p-4 shadow-sm sm:p-6">
          <div><label className="mb-1.5 block text-xs font-semibold text-[#514d46]" htmlFor="draft-title">Working title <span className="font-normal text-[#8a8277]">(optional)</span></label><input id="draft-title" value={brief.title} onChange={(event) => updateBrief("title", event.target.value)} className={fieldClass} placeholder="For example: National urban heat resilience policy" /></div>
          <div><label className="mb-1.5 block text-xs font-semibold text-[#514d46]" htmlFor="draft-objective">What should this policy solve? <span className="text-[#8f1d2c]">*</span></label><textarea id="draft-objective" required rows={4} value={brief.objective} onChange={(event) => updateBrief("objective", event.target.value)} className={`${fieldClass} resize-y`} placeholder="Describe the problem, desired change, and why it matters." /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold text-[#514d46]" htmlFor="draft-audience">Who is it for?</label><input id="draft-audience" value={brief.audience} onChange={(event) => updateBrief("audience", event.target.value)} className={fieldClass} placeholder="States, municipalities, households…" /></div><div><label className="mb-1.5 block text-xs font-semibold text-[#514d46]" htmlFor="draft-geography">Where does it apply?</label><input id="draft-geography" value={brief.geography} onChange={(event) => updateBrief("geography", event.target.value)} className={fieldClass} placeholder="India, or a state or sector" /></div></div>
          <div><label className="mb-1.5 block text-xs font-semibold text-[#514d46]" htmlFor="draft-requirements">What should the draft include?</label><textarea id="draft-requirements" rows={3} value={brief.requirements} onChange={(event) => updateBrief("requirements", event.target.value)} className={`${fieldClass} resize-y`} placeholder="Budget constraints, implementation timeline, equity lens, indicators…" /></div>
          {error && <p className="rounded-xl bg-[#f8e5e2] px-3 py-2 text-xs leading-5 text-[#9b3b40]">{error}</p>}
          <button type="submit" disabled={drafting || !brief.objective.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#8f1d2c] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#751623] disabled:cursor-not-allowed disabled:opacity-45">{drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{drafting ? draftingStage || "Preparing evidence…" : "Generate policy draft"}</button>
        </form>
        <section className="mt-5 rounded-3xl border border-[#8f1d2c]/10 bg-[#fffaf0] p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">Working document</p><h2 className="mt-1 font-serif text-2xl text-[#8f1d2c]">{draft ? "Your policy draft" : "Your draft will appear here"}</h2></div><div className="flex flex-wrap items-center gap-2">{draft && !drafting ? <><button type="button" onClick={downloadDraft} className="inline-flex items-center gap-1.5 rounded-xl border border-[#8f1d2c]/15 bg-white px-3 py-2 text-xs font-semibold text-[#874047] transition hover:bg-[#f4eae4]"><Download className="h-3.5 w-3.5" /> Download text</button><button type="button" onClick={downloadDocx} disabled={!draftId} className="inline-flex items-center gap-1.5 rounded-xl bg-[#8f1d2c] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#751623] disabled:opacity-45"><FileText className="h-3.5 w-3.5" /> Download DOCX</button></> : null}{drafting && <span className="inline-flex items-center gap-1.5 text-xs text-[#874047]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {draftingStage || "Writing"}</span>}</div></div>{draft ? <div className="prose prose-sm mt-5 max-w-none prose-headings:font-serif prose-headings:text-[#8f1d2c] prose-p:text-[#514d46] prose-li:text-[#514d46] prose-strong:text-[#29312d]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown></div> : <div className="mt-5 rounded-2xl border border-dashed border-[#8f1d2c]/15 px-5 py-10 text-center text-sm leading-6 text-[#8a8277]">Choose references, describe the policy problem, and generate a source-grounded first draft.</div>}</section>
        {citations.length > 0 && <section className="mt-5 rounded-3xl border border-[#8f1d2c]/10 bg-white p-4 sm:p-6"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#8f1d2c]" /><h2 className="text-sm font-semibold text-[#29312d]">Evidence used in this draft</h2></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{citations.map((citation, index) => <div key={`${citation.sourceId || citation.documentId || "source"}-${index}`} className="rounded-xl bg-[#f7f2eb] px-3 py-2.5"><p className="line-clamp-2 text-xs font-semibold text-[#29312d]">{citation.title}</p><p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#8a8277]">{citation.sourceType === "catalogue" ? `${citation.documentType || "document"} · ${citation.authority || "Rashtram catalogue"}` : "Your study source"}</p></div>)}</div></section>}
      </div>
    </main>
    {libraryOpen && <aside className="hidden min-h-0 overflow-hidden border-l border-[#8f1d2c]/10 lg:block">{libraryPanel}</aside>}
    <MobileWorkspaceSheet open={Boolean(mobilePanel)} title={mobilePanel === "sources" ? "Add websites and PDFs" : "Choose Rashtram documents"} onClose={() => setMobilePanel(null)}>
      {mobilePanel === "sources" ? <StudySourcesPanel sources={sources} selectedIds={selectedSourceIds} onToggle={toggleSource} onAddUrl={async (url) => addSource((await addResearchUrlSource(url)).source)} onAddPdf={async (file, options) => addSource((await addResearchPdfSource(file, options)).source)} onDelete={async (id) => { await deleteResearchSource(id); setSources((current) => current.filter((source) => String(source.id) !== String(id))); setSelectedSourceIds((current) => current.filter((sourceId) => sourceId !== String(id))); }} /> : libraryPanel}
    </MobileWorkspaceSheet>
  </div>;
}
