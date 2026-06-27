"use client";

import React, { useState } from "react";
import { LayoutDashboard, LogOut, FileText, Brain, Menu } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import BillsListUI from "@/components/Bills";
import ActsUI from "@/components/Acts";

import Dashboard from "@/components/Dashboard";

function AppLayout() {
  const [activeView, setActiveView] = useState("Dashboard");
  const { logout, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getUserInitials = (name) => {
    if (!name) return "U";
    const names = name.split(" ");
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const userName = user?.name || "User";
  const userInitials = getUserInitials(userName);

  const links = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      onClick: () => setActiveView("Dashboard"),
    },
    {
      label: "Parliament Bills",
      icon: Brain,
      onClick: () => setActiveView("Parliament Bills"),
    },
    {
      label: "Parliament Acts",
      icon: FileText,
      onClick: () => setActiveView("Parliament Acts"),
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-neutral-900 font-sans">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 transition-transform duration-200 ease-in-out",
          "md:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-neutral-800">
            <Logo />
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
            {links.map((link) => {
              const isActive = activeView === link.label;
              return (
                <button
                  key={link.label}
                  onClick={() => {
                    link.onClick();
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-red-50 text-[#B20F38] dark:bg-red-900/20 dark:text-red-400"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white",
                  )}
                >
                  <link.icon
                    className={cn(
                      "h-5 w-5",
                      isActive
                        ? "text-[#B20F38] dark:text-red-400"
                        : "text-gray-400 group-hover:text-gray-500",
                    )}
                  />
                  {link.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-neutral-800 space-y-2">
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-neutral-800/50">
              <div className="h-8 w-8 rounded-full bg-[#B20F38] flex items-center justify-center text-white text-xs font-bold">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {userName}
                </p>
                <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">
                  View Profile
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors dark:text-neutral-400 dark:hover:text-red-400 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <Logo />
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          <div className="max-w-7xl mx-auto h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {renderActiveView(activeView)}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );

  function renderActiveView(view) {
    switch (view) {
      case "Dashboard":
        return <Dashboard />;
      case "Parliament Bills":
        return <BillsListUI />;
      case "Parliament Acts":
        return <ActsUI />;
      default:
        return <Dashboard />;
    }
  }
}

export const Logo = () => {
  return (
    <Link
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20 pl-2"
    >
      <div className="h-6 w-6 bg-[#B20F38] flex items-center justify-center">
        <span className="text-white font-bold text-xs">R</span>
      </div>
      <span className="font-semibold text-lg tracking-tight text-gray-900 dark:text-white">
        Rashtram AI
      </span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20 pl-1"
    >
      <div className="h-6 w-6 bg-[#B20F38] flex items-center justify-center">
        <span className="text-white font-bold text-xs">R</span>
      </div>
    </Link>
  );
};

export default function App() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}
