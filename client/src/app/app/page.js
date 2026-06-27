"use client";

import { useState } from "react";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  Scale,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import BillsListUI from "@/components/Bills";
import ActsUI from "@/components/Acts";
import Dashboard from "@/components/Dashboard";
import { BrandMark } from "@/components/BrandMark";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Parliament Bills", icon: FileText },
  { label: "Parliament Acts", icon: Scale },
];

function getUserInitials(name) {
  if (!name) return "RA";
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function AppLayout() {
  const [activeView, setActiveView] = useState("Dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout, user } = useAuth();
  const userName = user?.name || "Researcher";

  const navigate = (view) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  const renderActiveView = () => {
    switch (activeView) {
      case "Parliament Bills":
        return <BillsListUI />;
      case "Parliament Acts":
        return <ActsUI />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

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
            Research workspace
          </p>
          <nav className="mt-3 space-y-1.5" aria-label="Workspace navigation">
            {navigation.map((item) => {
              const isActive = activeView === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.label)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition",
                    isActive
                      ? "bg-[#fffaf0] text-[#19231f] shadow-sm"
                      : "text-white/58 hover:bg-white/7 hover:text-white",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px]",
                      isActive ? "text-[#ad4a36]" : "text-white/42",
                    )}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mx-5 mt-8 rounded-2xl border border-white/8 bg-white/[0.055] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#efb36f]" />
            <div>
              <p className="text-xs font-semibold text-white/78">
                Evidence mode
              </p>
              <p className="mt-1 text-[11px] leading-5 text-white/38">
                Answers remain grounded in the selected parliamentary document.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-white/8 p-5">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.055] p-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d97745] text-xs font-bold text-white">
              {getUserInitials(userName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white/85">
                {userName}
              </p>
              <p className="truncate text-[11px] text-white/35">
                Policy researcher
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
        <header className="flex h-20 items-center justify-between border-b border-[#19231f]/9 bg-[#f7f2e8]/85 px-5 backdrop-blur-xl md:px-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9f4937]">
              Rashtram workspace
            </p>
            <h1 className="mt-1 text-sm font-semibold text-[#19231f]">
              {activeView}
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
          <div className="mx-auto h-full max-w-[1440px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="h-full"
              >
                {renderActiveView()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}
