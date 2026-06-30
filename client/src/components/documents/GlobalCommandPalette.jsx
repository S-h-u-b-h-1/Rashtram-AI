"use client";

import Link from "next/link";
import {
  FileSearch,
  BookOpenText,
  History,
  LayoutDashboard,
  Landmark,
  Search,
  Scale,
  ScrollText,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getRecentDocumentChats,
  searchDocuments,
} from "@/lib/api";
import { humanize } from "@/lib/document-links";

const PAGES = [
  { label: "Dashboard", href: "/app", icon: LayoutDashboard },
  { label: "Bills", href: "/app?view=bills", icon: FileSearch },
  { label: "State Bills", href: "/app/state-bills", icon: Landmark },
  { label: "Acts", href: "/app?view=acts", icon: Scale },
  {
    label: "Policies",
    href: "/app?view=policies",
    icon: BookOpenText,
  },
  { label: "Gazette", href: "/app/egazette", icon: ScrollText },
  { label: "Demo mode", href: "/app?demo=1", icon: LayoutDashboard },
  { label: "Profile and collections", href: "/app/profile", icon: Settings },
];

export function GlobalCommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    getRecentDocumentChats(6)
      .then((response) => setChats(response.chats || []))
      .catch(() => setChats([]));
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setDocuments([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await searchDocuments(query.trim(), {
          limit: 8,
          semantic: true,
        });
        setDocuments(response.documents || []);
      } catch {
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePages = normalizedQuery
    ? PAGES.filter((page) => page.label.toLowerCase().includes(normalizedQuery))
    : PAGES;
  const visibleChats = normalizedQuery
    ? chats.filter((chat) =>
        chat.title?.toLowerCase().includes(normalizedQuery),
      )
    : chats;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-[#101814]/55 px-4 pt-[10vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Search and command palette"
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-[#f7f2eb] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-[#8f1d2c]/9 px-5">
          <Search className="h-5 w-5 text-[#8f1d2c]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents, chats, pages, or commands…"
            className="h-16 min-w-0 flex-1 bg-transparent text-sm text-[#29312d] outline-none placeholder:text-[#918a7f]"
          />
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-[#777066] hover:bg-[#eee0dc]"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="app-scrollbar max-h-[65vh] overflow-y-auto p-3">
          {visiblePages.length > 0 && (
            <div>
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#874047]">
                {normalizedQuery ? "Pages and commands" : "Navigate"}
              </p>
              {visiblePages.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#29312d] hover:bg-[#eee0dc]"
                >
                  <Icon className="h-4 w-4 text-[#8f1d2c]" />
                  {label}
                </Link>
              ))}
            </div>
          )}

          {query.trim().length >= 2 && (
            <div>
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#874047]">
                Documents {loading ? "· searching" : ""}
              </p>
              {documents.map((document) => (
                <Link
                  key={document.id}
                  href={`/app/document/${document.id}`}
                  onClick={onClose}
                  className="block rounded-xl px-3 py-3 hover:bg-[#eee0dc]"
                >
                  <p className="truncate text-sm font-semibold text-[#29312d]">
                    {document.title}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#777066]">
                    {humanize(document.type)} ·{" "}
                    {document.ministry || document.authority || document.source}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {visibleChats.length > 0 && (
            <div className="mt-2 border-t border-[#8f1d2c]/7 pt-2">
              <p className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#874047]">
                <History className="h-3.5 w-3.5" />
                Recent research
              </p>
              {visibleChats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/app/document/${chat.documentId}`}
                  onClick={onClose}
                  className="block truncate rounded-xl px-3 py-3 text-sm text-[#29312d] hover:bg-[#eee0dc]"
                >
                  {chat.title}
                </Link>
              ))}
            </div>
          )}
        </div>
        <footer className="border-t border-[#8f1d2c]/8 px-5 py-3 text-[10px] text-[#777066]">
          Esc to close · Select up to five documents in the catalogue for
          cross-document chat.
        </footer>
      </section>
    </div>
  );
}
