"use client";
import Link from "next/link";
import { BookOpen, FolderOpen, Plus, Search, X, ArrowUpRight, FileText, History, PenLine, GitCompareArrows, Compass, Loader2, Landmark, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getProfile, getRecentDocumentChats, searchDocuments } from "@/lib/api";
import { humanize } from "@/lib/document-links";
import { resumeChatHref } from "@/lib/research-workspace.mjs";

const PAGES = [
  { label: "New Research", description: "Start with a question", href: "/app", icon: Plus },
  { label: "Library", description: "Browse laws and policies", href: "/app/library", icon: BookOpen },
  { label: "My Research", description: "Return to saved work", href: "/app/research", icon: FolderOpen },
  { label: "Draft a Policy", description: "Write from your sources", href: "/app/policy-drafter", icon: PenLine },
  { label: "Compare Documents", description: "Explore key differences", href: "/app/compare", icon: GitCompareArrows },
  { label: "Suggested Documents", description: "Find relevant reading", href: "/app/recommend", icon: Compass },
  { label: "State Bills", href: "/app/state-bills", icon: Landmark },
  { label: "State Acts", href: "/app/state-acts", icon: Landmark },
  { label: "Gazette", href: "/app/egazette", icon: FileText },
  { label: "Profile and collections", href: "/app/profile", icon: Settings },
];

export function GlobalCommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState([]);
  const [chats, setChats] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const dialog = useRef(null);
  const searchInput = useRef(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.allSettled([getRecentDocumentChats(6), getProfile()]).then(([chatResult, profileResult]) => {
      if (!active) return;
      setChats(chatResult.status === "fulfilled" ? chatResult.value.chats || [] : []);
      setRecentSearches(profileResult.status === "fulfilled" ? profileResult.value.account?.savedSearches?.slice(0, 5) || [] : []);
    });
    return () => { active = false; };
  }, [open]);
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setDocuments([]); setLoading(false); setSearchError("");
      return;
    }
    let active = true;
    setLoading(true); setDocuments([]); setSearchError("");
    const timer = setTimeout(async () => {
      try {
        const response = await searchDocuments(query.trim(), { limit: 8, semantic: true });
        if (active) setDocuments(response.documents || []);
      } catch {
        if (active) setSearchError("Search is temporarily unavailable. Try again or browse the Library.");
      } finally { if (active) setLoading(false); }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [open, query]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    searchInput.current?.focus();
    const keyboard = event => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      const nodes = [...dialog.current.querySelectorAll('a[href], button:not(:disabled), input')].filter(node => node.getClientRects().length);
      if (event.key === "Tab") {
        if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
      }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        const results = [...dialog.current.querySelectorAll('[data-search-result]')];
        if (!results.length) return;
        event.preventDefault();
        const index = results.indexOf(document.activeElement);
        const next = index < 0 ? (event.key === "ArrowDown" ? 0 : results.length - 1) : (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
        results[next]?.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  const normalized = query.trim().toLowerCase();
  const pages = normalized ? PAGES.filter(page => `${page.label} ${page.description || ''}`.toLowerCase().includes(normalized)) : PAGES.slice(0, 6);
  const visibleChats = normalized ? chats.filter(chat => chat.title?.toLowerCase().includes(normalized)) : chats.slice(0, 3);
  return <div className="command-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="workspace-search-title" className="command-dialog">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3"><div><h2 id="workspace-search-title" className="text-lg font-semibold text-[#29312d]">Search your workspace</h2><p className="mt-1 text-xs text-[#706a61]">Documents, recent research and shortcuts</p></div><button type="button" onClick={onClose} aria-label="Close command palette" className="workspace-secondary-button shrink-0"><X className="h-4 w-4" /></button></div>
      <div className="px-4 pb-4 sm:px-5"><div className="workspace-input-surface flex items-center gap-3 rounded-xl bg-white px-3">
        {loading ? <Loader2 aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin text-[#8f1d2c]" /> : <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-[#8f1d2c]" />}
        <input ref={searchInput} aria-label="Search documents and research" aria-describedby="workspace-search-hint" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search documents…" className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[#29312d] placeholder:text-[#706a61]" />
        {query && <button type="button" onClick={() => { setQuery(''); searchInput.current?.focus(); }} aria-label="Clear search" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#706a61]"><X className="h-4 w-4" /></button>}
      </div></div>
      <div className="command-results app-scrollbar">
        {normalized.length >= 2 && <section aria-label="Document results" className="mb-4"><h3 className="command-section-title">Documents</h3>
          {loading && <p role="status" className="px-2 py-4 text-xs text-[#706a61]">Searching the catalogue…</p>}
          {searchError && <p role="alert" className="rounded-xl bg-[#f2e7e3] p-4 text-xs text-[#8f1d2c]">{searchError}</p>}
          {!loading && !searchError && !documents.length && <p role="status" className="rounded-xl bg-[#f5f1eb] p-4 text-xs text-[#706a61]">No documents found. Try a broader topic or a document title.</p>}
          {documents.map(doc => <Link data-search-result key={doc.id} href={`/app/document/${doc.id}`} onClick={onClose} className="command-result-row"><span className="command-icon"><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-snug">{doc.title}</span><span className="mt-1 block text-xs text-[#706a61]">{humanize(doc.type)} · {doc.ministry || doc.authority || doc.source}</span></span><ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#706a61]" /></Link>)}
        </section>}
        {pages.length > 0 && <section aria-label="Workspace shortcuts"><h3 className="command-section-title">{normalized ? 'Matching shortcuts' : 'Quick actions'}</h3><div className="grid gap-2 sm:grid-cols-2">{pages.map(({ label, href, description, icon: Icon }) => <Link data-search-result key={href} href={href} onClick={onClose} className="command-shortcut"><span className="command-icon"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-xs font-semibold">{label}</span>{description && <span className="mt-0.5 block text-xs text-[#706a61]">{description}</span>}</span></Link>)}</div></section>}
        {visibleChats.length > 0 && <section className="mt-5" aria-label="Recent research"><h3 className="command-section-title">Recent research</h3>{visibleChats.map(chat => <Link data-search-result key={chat.id} href={resumeChatHref(chat)} onClick={onClose} className="command-result-row"><History aria-hidden="true" className="h-4 w-4 shrink-0 text-[#706a61]" /><span className="line-clamp-2 text-xs">{chat.title}</span><ArrowUpRight aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-[#706a61]" /></Link>)}</section>}
        {!normalized && recentSearches.length > 0 && <section className="mt-5" aria-label="Saved searches"><h3 className="command-section-title">Saved searches</h3>{recentSearches.map(search => <Link data-search-result key={search.id} href={`/app/library?q=${encodeURIComponent(search.query || '')}`} onClick={onClose} className="command-result-row"><Search className="h-4 w-4 shrink-0" /><span className="text-xs">{search.name}</span></Link>)}</section>}
      </div>
      <footer id="workspace-search-hint" className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8e0d5] px-5 py-3 text-xs text-[#706a61]"><span>↑ ↓ to navigate · Enter to open</span><span>Esc to close</span></footer>
    </section>
  </div>;
}
