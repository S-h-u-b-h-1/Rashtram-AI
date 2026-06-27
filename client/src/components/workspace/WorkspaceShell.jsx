"use client";

import Link from "next/link";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  Scale,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const NAVIGATION = [
  {
    key: "dashboard",
    label: "Intelligence",
    href: "/app",
    icon: LayoutDashboard,
  },
  {
    key: "bills",
    label: "Parliament Bills",
    href: "/app?view=bills",
    icon: FileText,
  },
  {
    key: "acts",
    label: "Parliament Acts",
    href: "/app?view=acts",
    icon: Scale,
  },
  {
    key: "profile",
    label: "Profile",
    href: "/app/profile",
    icon: UserRound,
  },
];

const getUserInitials = (name) => {
  if (!name) return "RA";
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

export function WorkspaceShell({ activeKey, title, children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout, user } = useAuth();
  const userName = user?.name || "Researcher";

  return (
    <div className="flex h-screen overflow-hidden bg-[#eee8dc]">
      {isMobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#101814]/55 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/8 bg-[#19231f] text-white transition-transform duration-300 md:static md:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/8 px-6">
          <BrandMark inverse href="/" />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-lg text-white/55 hover:bg-white/8 hover:text-white md:hidden"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-7">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
            Legislative workspace
          </p>
          <nav className="mt-3 space-y-1.5" aria-label="Workspace navigation">
            {NAVIGATION.map((item) => {
              const isActive = activeKey === item.key;
              const NavigationIcon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-[#fffaf0] text-[#19231f] shadow-sm"
                      : "text-white/58 hover:bg-white/7 hover:text-white",
                  )}
                >
                  <NavigationIcon
                    className={cn(
                      "h-[18px] w-[18px]",
                      isActive ? "text-[#ad4a36]" : "text-white/42",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mx-5 mt-8 rounded-2xl border border-white/8 bg-white/[0.055] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#efb36f]" />
            <div>
              <p className="text-xs font-semibold text-white/78">
                Source-aware research
              </p>
              <p className="mt-1 text-[11px] leading-5 text-white/38">
                Live items show provenance. Planned feeds are never presented
                as current news.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-white/8 p-5">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.055] p-3">
            <Link
              href="/app/profile"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d97745] text-xs font-bold text-white"
              aria-label="Open profile"
            >
              {getUserInitials(userName)}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white/85">
                {userName}
              </p>
              <p className="truncate text-[11px] text-white/35">
                Legislative researcher
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="grid h-9 w-9 place-items-center rounded-lg text-white/38 transition hover:bg-white/8 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-[#19231f]/9 bg-[#f7f2e8]/85 px-5 backdrop-blur-xl md:px-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9f4937]">
              Rashtram intelligence
            </p>
            <h1 className="mt-1 text-sm font-semibold text-[#19231f]">
              {title}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-xl border border-[#19231f]/10 bg-white text-[#19231f] md:hidden"
            aria-label="Open navigation"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </header>

        <main className="app-scrollbar flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="mx-auto min-h-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
