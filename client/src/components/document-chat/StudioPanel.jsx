import { Sparkles } from "lucide-react";
import { DocumentSummaryPanel } from "./DocumentSummaryPanel";
import { DocumentTimeline } from "./DocumentTimeline";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { RelatedDocuments } from "./RelatedDocuments";
import { ResearchNotes } from "./ResearchNotes";
import { ResearchWorkflowPanel } from "./ResearchWorkflowPanel";

export function StudioPanel({
  document,
  summary,
  notes,
  onAddNote,
  onDeleteNote,
  disabled,
  onRunWorkflow,
}) {
  return (
    <section className="app-scrollbar h-full overflow-y-auto bg-[#f8f6f1]">
      <div className="border-b border-[#8f1d2c]/10 px-4 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">Studio</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-[#29312d]"><Sparkles className="h-4 w-4 text-[#8f1d2c]" /> Research tools</h2>
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
        <KnowledgeGraph graph={document.graph} />
        <ResearchNotes notes={notes} onAdd={onAddNote} onDelete={onDeleteNote} />
      </div>
    </section>
  );
}
