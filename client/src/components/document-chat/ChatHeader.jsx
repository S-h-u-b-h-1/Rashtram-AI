"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, ExternalLink, MoreHorizontal } from "lucide-react";
import { CollectionMenu } from "./CollectionMenu";
import { comparisonDisabledReason, canPrepareForResearch, comparisonHrefForDocuments, useComparison } from "@/context/ComparisonContext";
import { isSourceOnlyResearchDocument, shouldShowPdfAction } from "@/lib/document-readiness";

const itemClass = "flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm outline-none focus:bg-[#eee0dc] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45";

export function ChatHeader({ document, isPinned, onPin, onBookmark, onExport }) {
  const router = useRouter();
  const { addDocument, prepareAndAddDocument, removeDocument, isSelected } = useComparison();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const selected = isSelected(document.id);
  const compareDisabled = comparisonDisabledReason(document);
  const canPrepare = canPrepareForResearch(document);
  const compare = async () => {
    if (selected) { removeDocument(document.id); return; }
    setPreparing(true); setError('');
    try {
      const result = canPrepare ? await prepareAndAddDocument(document) : addDocument(document);
      if (!result.ok) { setError(result.reason || 'This source is not ready for comparison.'); return; }
      const href = comparisonHrefForDocuments(result.documents);
      if (href) router.push(href);
    } catch (failure) { setError(failure.message || 'Could not add this source. Try again.'); }
    finally { setPreparing(false); }
  };
  return <>
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#8f1d2c] px-3 py-2 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/app" aria-label="Back to New Research" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/15"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="min-w-0"><h1 className="truncate text-sm font-semibold" title={document.title}>{document.title}</h1><p className="mt-1 truncate text-xs text-white/80">{document.documentType || document.type} · Research workspace</p></div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {document.sourceUrl && <a href={document.sourceUrl} target="_blank" rel="noreferrer" aria-label="Open source page" className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-xs text-white hover:bg-white/10 sm:inline-flex">Source<ExternalLink className="h-4 w-4" /></a>}
        <CollectionMenu document={document} />
        <DropdownMenu.Root><DropdownMenu.Trigger aria-label="More document actions" className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/15"><MoreHorizontal className="h-5 w-5" /></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="z-[90] w-64 max-w-[calc(100vw-24px)] rounded-xl border border-[#8f1d2c]/15 bg-[#f8f6f1] p-2 text-[#29312d] shadow-xl">
          {shouldShowPdfAction(document) && <DropdownMenu.Item asChild><a href={document.pdfUrl} target="_blank" rel="noreferrer" className={itemClass}>Open official PDF</a></DropdownMenu.Item>}
          {document.sourceUrl && <DropdownMenu.Item asChild><a href={document.sourceUrl} target="_blank" rel="noreferrer" className={itemClass}>Open source page</a></DropdownMenu.Item>}
          {!isSourceOnlyResearchDocument(document) && <DropdownMenu.Item disabled={preparing || (Boolean(compareDisabled) && !canPrepare)} onSelect={compare} className={itemClass}>{preparing ? 'Preparing comparison…' : selected ? 'Remove from comparison' : 'Add to comparison'}</DropdownMenu.Item>}
          <DropdownMenu.Item onSelect={onBookmark} className={itemClass}>Bookmark document</DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onPin} className={itemClass}>{isPinned ? 'Unpin chat' : 'Pin chat'}</DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onExport} className={itemClass}>Export conversation</DropdownMenu.Item>
          <DropdownMenu.Item asChild><Link href="/app/research" className={itemClass}>My Research</Link></DropdownMenu.Item>
        </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
      </div>
    </header>
    {error && <p role="alert" className="shrink-0 bg-[#f4e4e0] px-4 py-2 text-xs text-[#85434a]">{error}</p>}
  </>;
}
