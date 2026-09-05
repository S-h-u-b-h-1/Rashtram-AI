"use client";

import Link from "next/link";
import { BookOpen, FolderOpen, Plus, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { GlobalCommandPalette } from "@/components/documents/GlobalCommandPalette";
import { ComparisonTray } from "@/components/documents/ComparisonTray";
import { useComparison } from "@/context/ComparisonContext";
import { PRIMARY_NAVIGATION } from "@/lib/research-workspace.mjs";
import { useRecentResearch } from "@/hooks/useRecentResearch";

const ICONS = { dashboard: Plus, documents: BookOpen, research: FolderOpen };
const LIBRARY_KEYS = ["documents", "bills", "acts", "policies", "egazette", "state-bills", "state-acts", "recommend"];

export function WorkspaceShell({ activeKey, title, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { logout, user } = useAuth();
  const { documents: comparisonDocuments } = useComparison();
  const { items: recent } = useRecentResearch(4);
  const navRef = useRef(null);
  const openButton = useRef(null);
  const active = LIBRARY_KEYS.includes(activeKey) ? "documents" : activeKey;

  useEffect(() => {
    const shortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const trigger = openButton.current;
    navRef.current?.querySelector("button, a")?.focus();
    const keyboard = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const nodes = [...navRef.current.querySelectorAll("a, button")].filter((node) => node.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", keyboard);
    return () => { window.removeEventListener("keydown", keyboard); trigger?.focus(); };
  }, [mobileOpen]);

  return (
    <div className="fixed inset-0 flex w-full max-w-full overflow-hidden bg-[#f8f6f1] text-[#29312d]">
      {mobileOpen && <button type="button" tabIndex={-1} className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <aside ref={navRef} role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined} aria-label="Workspace navigation"
        className={cn("fixed inset-y-0 left-0 z-50 flex h-full overflow-y-auto overscroll-contain w-[min(280px,88vw)] flex-col border-r border-[#8f1d2c]/10 bg-[#f1ece3] transition-transform lg:static lg:w-[280px] lg:translate-x-0 lg:shrink-0",
          mobileOpen ? "translate-x-0 visible" : "-translate-x-full invisible lg:visible", collapsed && "lg:hidden")}>
        <div className="flex h-20 shrink-0 items-center justify-between px-5">
          <BrandMark href="/app" />
          <button type="button" onClick={() => setMobileOpen(false)} className="grid h-11 w-11 place-items-center rounded-lg lg:hidden" aria-label="Close sidebar"><X className="h-5 w-5" /></button>
          <button type="button" onClick={() => setCollapsed(true)} className="hidden h-11 w-11 place-items-center rounded-lg hover:bg-[#e9e3da] lg:grid" aria-label="Collapse navigation"><PanelLeftClose className="h-4 w-4" /></button>
        </div>
        <nav className="space-y-2 px-4" aria-label="Primary navigation">
          {PRIMARY_NAVIGATION.map((item) => { const Icon = ICONS[item.key]; return (
            <Link key={item.key} href={item.href} onClick={() => setMobileOpen(false)} aria-current={active === item.key ? "page" : undefined}
              className={cn("flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium transition", active === item.key ? "bg-[#8f1d2c] text-white" : "text-[#514d46] hover:bg-[#e9e3da]")}>
              <Icon className="h-[18px] w-[18px]" />{item.label}
            </Link>
          ); })}
        </nav>
        {recent.length > 0 && <div className="mt-9 px-4">
          <p className="px-4 text-xs font-medium text-[#706a61]">Recent</p>
          <div className="mt-2 space-y-1">{recent.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} title={item.title}
            className="block truncate rounded-lg px-4 py-3 text-sm text-[#514d46] hover:bg-[#e9e3da]">{item.title}</Link>)}</div>
        </div>}
        <nav className="mt-auto grid grid-cols-2 gap-1 px-5 pb-4 pt-8 text-xs text-[#706a61]" aria-label="Utilities">
          {[['Profile', '/app/profile'], ['Settings', '/app/settings'], ['Help', '/app/help'], ['Coverage & Sources', '/app/coverage']].map(([label, href]) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center rounded-lg px-2 hover:bg-[#e9e3da]">{label}</Link>)}
        </nav>
        <div className="flex items-center gap-2 border-t border-[#8f1d2c]/10 px-5 py-4">
          <Link href="/app/profile" className="min-w-0 flex-1 truncate rounded-lg py-2 text-sm font-medium">{user?.name || "Researcher"}</Link>
          <button type="button" onClick={logout} className="grid h-11 w-11 place-items-center rounded-lg text-[#706a61] hover:bg-[#e9e3da]" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" inert={mobileOpen ? true : undefined}>
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-2">
            <button ref={openButton} type="button" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
            {collapsed && <button type="button" onClick={() => setCollapsed(false)} className="hidden h-11 w-11 place-items-center rounded-lg lg:grid" aria-label="Expand navigation"><PanelLeftOpen className="h-4 w-4" /></button>}
            <h1 className="truncate text-sm font-medium text-[#706a61]">{title}</h1>
          </div>
          <button type="button" onClick={() => setPaletteOpen(true)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-[#706a61] hover:bg-[#f1ece3]" aria-label="Search Library shortcut">
            <Search className="h-4 w-4" /><kbd className="hidden text-[11px] sm:inline">⌘K</kbd>
          </button>
        </header>
        <main className={cn("app-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-7", comparisonDocuments.length ? "pb-32" : "pb-8")}>
          <div className="mx-auto w-full min-w-0 max-w-[1320px]">{children}</div>
        </main>
      </div>
      <GlobalCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ComparisonTray />
    </div>
  );
}
