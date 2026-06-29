import { formatDate, humanize } from "@/lib/document-links";
import { DocumentSummaryPanel } from "./DocumentSummaryPanel";
import { RelatedDocuments } from "./RelatedDocuments";
import { ResearchNotes } from "./ResearchNotes";
import { SourcePanel } from "./SourcePanel";
import { DocumentTimeline } from "./DocumentTimeline";
import { KnowledgeGraph } from "./KnowledgeGraph";

export function ChatSidebar({
  document,
  summary,
  notes,
  onAddNote,
  onDeleteNote,
}) {
  const metadata = [
    ["Type", humanize(document.documentType)],
    ["Status", document.status],
    ["Ministry", document.ministry],
    ["Department", document.department],
    ["Jurisdiction", document.jurisdiction],
    ["Year", document.year],
    ["Published", formatDate(document.publicationDate, null)],
    ["Gazette number", document.gazetteNumber],
  ].filter(([, value]) => value);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
          Document metadata
        </p>
        <dl className="mt-3 grid gap-2">
          {metadata.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-[#8f1d2c]/8 bg-white p-3"
            >
              <dt className="text-[9px] uppercase tracking-[0.1em] text-[#8a8277]">
                {label}
              </dt>
              <dd className="mt-1 text-xs leading-5 text-[#514d46]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <DocumentSummaryPanel summary={summary} />
      <SourcePanel document={document} />
      <RelatedDocuments
        relationships={document.relationships}
        recommendations={document.recommendations}
      />
      <DocumentTimeline events={document.timeline || []} />
      <KnowledgeGraph graph={document.graph} />
      <ResearchNotes
        notes={notes}
        onAdd={onAddNote}
        onDelete={onDeleteNote}
      />
    </div>
  );
}
