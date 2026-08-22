"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Download,
  ExternalLink,
  FileDown,
  Pin,
  GitCompareArrows,
  MoreHorizontal,
} from "lucide-react";
import { CollectionMenu } from "./CollectionMenu";
import {
  comparisonDisabledReason,
  comparisonHrefForDocuments,
  useComparison,
} from "@/context/ComparisonContext";
import {
  isSourceOnlyResearchDocument,
  shouldShowPdfAction,
} from "@/lib/document-readiness";

export function ChatHeader({
  document,
  isPinned,
  onPin,
  onBookmark,
  onExport,
}) {
  const router = useRouter();
  const { addDocument, removeDocument, isSelected } = useComparison();
  const selected = isSelected(document.id);
  const compareDisabled = comparisonDisabledReason(document);
  const sourceOnlyActions = isSourceOnlyResearchDocument(document);
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-[#8f1d2c] px-4 py-3 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/app"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/8 text-white/70 hover:text-white"
          aria-label="Back to research workspace"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{document.title}</p>
          <p className="mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-white/45">
            {document.documentType} research workspace
          </p>
        </div>
      </div>
      <div className="relative flex shrink-0 gap-1.5">
        {!sourceOnlyActions && (
          <button
            type="button"
            disabled={Boolean(compareDisabled)}
            title={compareDisabled || undefined}
            onClick={() => {
              if (selected) {
                removeDocument(document.id);
                return;
              }
              const result = addDocument(document);
              const href = result.ok
                ? comparisonHrefForDocuments(result.documents)
                : null;
              if (href) router.push(href);
            }}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={
              selected
                ? "Remove document from comparison"
                : "Add document to comparison"
            }
          >
            <GitCompareArrows className="h-4 w-4" />
          </button>
        )}
        <div className="hidden items-center gap-1.5 sm:flex">
        {shouldShowPdfAction(document) && (
          <a
            href={document.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/70 hover:text-white"
            aria-label="Open official PDF"
          >
            <FileDown className="h-4 w-4" />
          </a>
        )}
        {document.sourceUrl && (
          <a
            href={document.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/8 px-3 text-[10px] font-semibold text-white/75 hover:text-white"
            aria-label="Open source page"
          >
            Source
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          type="button"
          onClick={onBookmark}
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/70 hover:text-white"
          aria-label="Bookmark document"
        >
          <Bookmark className="h-4 w-4" />
        </button>
        <CollectionMenu document={document} />
        <button
          type="button"
          onClick={onPin}
          className={`grid h-9 w-9 place-items-center rounded-xl ${
            isPinned ? "bg-[#c1a06f] text-[#5a1320]" : "bg-white/8 text-white/70"
          }`}
          aria-label={isPinned ? "Unpin chat" : "Pin chat"}
        >
          <Pin className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onExport}
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/70 hover:text-white"
          aria-label="Export conversation"
        >
          <Download className="h-4 w-4" />
        </button>
        </div>
        <details className="group relative sm:hidden">
          <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl bg-white/8 text-white/75 [&::-webkit-details-marker]:hidden" aria-label="More document actions">
            <MoreHorizontal className="h-5 w-5" />
          </summary>
          <div className="absolute right-0 top-12 z-50 grid w-52 gap-1 rounded-2xl border border-[#8f1d2c]/10 bg-[#fffaf0] p-2 text-[#29312d] shadow-2xl">
            {shouldShowPdfAction(document) && <a href={document.pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-2.5 text-xs font-semibold">Open official PDF</a>}
            {document.sourceUrl && <a href={document.sourceUrl} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-2.5 text-xs font-semibold">Open source page</a>}
            <button type="button" onClick={onBookmark} className="rounded-xl px-3 py-2.5 text-left text-xs font-semibold">Bookmark document</button>
            <button type="button" onClick={onPin} className="rounded-xl px-3 py-2.5 text-left text-xs font-semibold">{isPinned ? "Unpin chat" : "Pin chat"}</button>
            <button type="button" onClick={onExport} className="rounded-xl px-3 py-2.5 text-left text-xs font-semibold">Export conversation</button>
          </div>
        </details>
      </div>
    </header>
  );
}
