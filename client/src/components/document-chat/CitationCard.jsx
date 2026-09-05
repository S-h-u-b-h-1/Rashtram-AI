import { ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/document-links";

export function CitationCard({ source, index }) {
  const rawHref = source.pdfUrl || source.sourceUrl;
  const sourceHref = /^https?:\/\//i.test(rawHref || "") ? rawHref : null;
  const sectionLabel = source.sectionPath?.length ? source.sectionPath.join(" › ") : source.heading || source.sectionTitle || source.sectionId;
  const label = source.label || source.citationId || source.id || source.passage || index + 1;
  return <details className="max-w-full rounded-lg border border-[#8f1d2c]/15 bg-white text-xs">
    <summary className="min-h-11 cursor-pointer list-none px-3 py-3 font-semibold text-[#8f1d2c] [&::-webkit-details-marker]:hidden">[{label}] <span className="font-normal text-[#514d46]">{source.documentTitle || source.title || `Source ${index + 1}`}</span></summary>
    <div className="max-w-[520px] border-t border-[#8f1d2c]/10 p-3">
      <p className="text-[11px] leading-5 text-[#706a61]">{[source.authority || source.ministry, formatDate(source.publicationDate || source.date, ''), source.pageStart ? `Page ${source.pageStart}${source.pageEnd && source.pageEnd !== source.pageStart ? `–${source.pageEnd}` : ''}` : null, sectionLabel, String(source.languageCode || '').startsWith('hi') ? 'Original Hindi' : null].filter(Boolean).join(' · ')}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-[#514d46]">{source.content || source.text || source.excerpt || "Open the original source to inspect this reference."}</p>
      {sourceHref && <a href={sourceHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#8f1d2c]">Open original source<ExternalLink className="h-3.5 w-3.5" /></a>}
    </div>
  </details>;
}
