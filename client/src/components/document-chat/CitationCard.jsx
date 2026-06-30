import { ExternalLink } from "lucide-react";

export function CitationCard({ source, index }) {
  return (
    <article className="rounded-xl border border-[#8f1d2c]/8 bg-[#f1ece3] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#874047]">
          Passage {source.passage || index + 1}
          {String(source.languageCode || "").startsWith("hi")
            ? " · Original Hindi"
            : ""}
        </p>
        {source.pdfUrl && (
          <a
            href={source.pdfUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open passage ${source.passage || index + 1} source PDF`}
            className="text-[#874047]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-[#706a61]">
        {source.content}
      </p>
      {Number.isFinite(Number(source.score)) && (
        <p className="mt-2 font-mono text-[9px] text-[#9a9387]">
          relevance {Math.round(Number(source.score) * 100)}%
        </p>
      )}
    </article>
  );
}
