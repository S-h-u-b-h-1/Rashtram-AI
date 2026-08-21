import { PanelRightClose, Sparkles } from "lucide-react";
import { DocumentSummaryPanel } from "./DocumentSummaryPanel";
import { DocumentTimeline } from "./DocumentTimeline";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { RelatedDocuments } from "./RelatedDocuments";
import { ResearchNotes } from "./ResearchNotes";
import { ResearchWorkflowPanel } from "./ResearchWorkflowPanel";
import { AmendmentTrackerPanel } from "./AmendmentTrackerPanel";

export function StudioPanel({
  document,
  summary,
  notes,
  onAddNote,
  onDeleteNote,
  disabled,
  onRunWorkflow,
  onCollapse,
}) {
  return (
    <section className="app-scrollbar h-full overflow-y-auto bg-[#f8f6f1]">
      <div className="border-b border-[#8f1d2c]/10 px-4 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">Studio</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#29312d]"><Sparkles className="h-4 w-4 text-[#8f1d2c]" /> Research tools</h2>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#8f1d2c]/12 bg-white text-[#874047] transition hover:bg-[#eee0dc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f1d2c]/30 lg:grid"
              aria-label="Collapse research tools"
              title="Collapse research tools"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[#706a61]">Turn this source into a brief, risk scan, stakeholder map, or policy draft.</p>
      </div>
      <div className="space-y-4 p-3">
        <ResearchWorkflowPanel document={document} disabled={disabled} onRunWorkflow={onRunWorkflow} />
        <DocumentSummaryPanel summary={summary} />
        <RelatedDocuments
          sourceDocumentType={document.documentType || document.type}
          relationships={document.relationships}
          recommendations={document.recommendations}
          relatedChats={document.relatedChats}
        />
        <DocumentTimeline events={document.timeline || []} />
        <AmendmentTrackerPanel documentId={document.id} />
        <KnowledgeGraph graph={document.graph} />
        <ResearchNotes notes={notes} onAdd={onAddNote} onDelete={onDeleteNote} />
      </div>
    </section>
  );
}
