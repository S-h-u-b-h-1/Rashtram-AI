"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { fetchDocuments } from "@/lib/api";
import { isResearchReady } from "@/lib/document-readiness";
import { formatDate, humanize } from "@/lib/document-links";

export function CatalogueSourcePicker({ open, onOpenChange, documents = [], onConfirm }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(documents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const identity = documents.map((item) => item.id).join(',');
  const documentsRef = useRef(documents);
  useEffect(() => { documentsRef.current = documents; }, [documents]);
  useEffect(() => { if (open) setSelected(documentsRef.current); }, [open, identity]);
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try { const result = await fetchDocuments({ search: query.trim(), researchReady: true, semantic: query.trim().length >= 3, sortBy: query.trim() ? "relevance" : "publicationDate", limit: 12, signal: controller.signal }); if (!controller.signal.aborted) setResults((result.documents || []).filter(isResearchReady)); }
      catch (failure) { if (!controller.signal.aborted) setError(failure.message || "Could not load sources. Try again."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query]);
  const candidates = [...new Map([...selected, ...results].map((item) => [String(item.id), item])).values()];
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" /><Dialog.Content className="fixed left-1/2 top-1/2 z-[81] flex max-h-[90dvh] w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-[#f8f6f1] p-4 shadow-xl sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><Dialog.Title className="text-xl font-semibold text-[#29312d]">Choose Library sources</Dialog.Title><Dialog.Description className="mt-2 text-xs leading-5 text-[#706a61]">Select up to five ready documents. Changing the document set opens its saved conversation; the previous conversation remains in My Research.</Dialog.Description></div><Dialog.Close className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" aria-label="Close Library source picker"><X className="h-5 w-5" /></Dialog.Close></div>
    <label className="mt-4 block"><span className="sr-only">Find a Library source</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or topic…" className="h-12 w-full rounded-xl border border-[#8f1d2c]/20 bg-white px-3 text-sm" /></label>
    {error && <p role="alert" className="py-3 text-sm text-[#85434a]">{error}</p>}
    <div className="mt-3 min-h-0 overflow-y-auto">{loading && <p role="status" className="py-3 text-sm text-[#706a61]">Finding sources…</p>}{!loading && !candidates.length && <p className="py-6 text-sm text-[#706a61]">No ready sources found. Try a different title or topic.</p>}
      {candidates.map((item) => { const checked = selected.some((entry) => String(entry.id) === String(item.id)); return <label key={item.id} className="flex cursor-pointer items-start gap-3 border-b border-[#8f1d2c]/10 py-4"><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 5} onChange={() => setSelected((current) => checked ? current.filter((entry) => String(entry.id) !== String(item.id)) : [...current, item])} className="mt-1 h-5 w-5 shrink-0 accent-[#8f1d2c]" /><span><span className="block text-sm font-medium leading-6">{item.title}</span><span className="mt-1 block text-xs leading-5 text-[#706a61]">{[humanize(item.type), item.authority || item.ministry, item.jurisdiction, formatDate(item.publicationDate, item.year || '')].filter(Boolean).join(' · ')}</span></span></label>; })}
    </div>
    <button type="button" disabled={!selected.length} onClick={() => { onConfirm(selected); onOpenChange(false); }} className="mt-4 min-h-12 shrink-0 rounded-xl bg-[#8f1d2c] px-4 text-sm font-semibold text-white disabled:opacity-50">Use {selected.length} selected {selected.length === 1 ? "source" : "sources"}</button>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
