"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  Download,
  FileDown,
  Pin,
  GitCompareArrows,
} from "lucide-react";
import { CollectionMenu } from "./CollectionMenu";
import {
  comparisonDisabledReason,
  useComparison,
} from "@/context/ComparisonContext";

export function ChatHeader({
  document,
  isPinned,
  onPin,
  onBookmark,
  onExport,
}) {
  const { addDocument, removeDocument, isSelected } = useComparison();
  const selected = isSelected(document.id);
  const compareDisabled = comparisonDisabledReason(document);
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
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          disabled={Boolean(compareDisabled)}
          title={compareDisabled || undefined}
          onClick={() =>
            selected ? removeDocument(document.id) : addDocument(document)
          }
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={
            selected ? "Remove document from comparison" : "Add document to comparison"
          }
        >
          <GitCompareArrows className="h-4 w-4" />
        </button>
        {document.pdfUrl && (
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
    </header>
  );
}
