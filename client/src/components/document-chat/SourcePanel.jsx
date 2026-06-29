import { ExternalLink, FileDown } from "lucide-react";

export function SourcePanel({ document }) {
  return (
    <section className="rounded-2xl border border-[#8f1d2c]/8 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#874047]">
        Original record
      </p>
      <p className="mt-2 text-xs leading-5 text-[#706a61]">
        {document.sourceName || "Verified public legislative source"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {document.pdfUrl && (
          <a
            href={document.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-[#8f1d2c] px-3 py-2 text-[10px] font-semibold text-white"
          >
            <FileDown className="h-3 w-3" />
            PDF
          </a>
        )}
        {document.sourceUrl && (
          <a
            href={document.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-[#8f1d2c]/10 px-3 py-2 text-[10px] font-semibold text-[#874047]"
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
        )}
      </div>
    </section>
  );
}
