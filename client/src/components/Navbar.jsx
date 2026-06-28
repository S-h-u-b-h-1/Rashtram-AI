"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LogOut, Menu, User, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BrandMark } from "@/components/BrandMark";

const links = [
  { href: "/#capabilities", label: "Capabilities" },
  { href: "/#workflow", label: "How it works" },
  { href: "/product", label: "Product" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, user, logout, loading } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 18);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[#c30000]/10 bg-[#fffdf8]/88 shadow-[0_10px_35px_rgba(195, 0, 0,0.06)] backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <nav
        className="mx-auto flex h-20 max-w-[1240px] items-center justify-between px-5 sm:px-8"
        aria-label="Primary navigation"
      >
        <BrandMark />

        <div className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[#5f5a52] transition hover:text-[#c30000]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {!loading &&
            (isAuthenticated ? (
              <>
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 rounded-full border border-[#c30000]/12 bg-white/60 px-4 py-2.5 text-sm font-medium text-[#c30000] transition hover:bg-white"
                >
                  <User className="h-4 w-4" />
                  {user?.name?.split(" ")[0] || "Workspace"}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="grid h-10 w-10 place-items-center rounded-full text-[#6c665d] transition hover:bg-[#c30000]/5 hover:text-[#c30000]"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2.5 text-sm font-medium text-[#5f5a52] transition hover:text-[#c30000]"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-[#c30000] px-5 py-2.5 text-sm font-medium text-[#fffaf0] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#2b3732]"
                >
                  Start researching
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </>
            ))}
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="grid h-11 w-11 place-items-center rounded-full border border-[#c30000]/10 bg-white/70 text-[#c30000] lg:hidden"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
        >
          {isMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </nav>

      {isMenuOpen && (
        <div
          id="mobile-navigation"
          className="border-t border-[#c30000]/10 bg-[#fffdf8] px-5 pb-6 pt-4 shadow-xl lg:hidden"
        >
          <div className="mx-auto flex max-w-[1240px] flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-[#3c443f] hover:bg-[#c30000]/5"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#c30000]/10 pt-4">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/app"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-xl border border-[#c30000]/10 px-4 py-3 text-center text-sm font-medium"
                  >
                    Workspace
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-xl bg-[#c30000] px-4 py-3 text-sm font-medium text-white"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-xl border border-[#c30000]/10 px-4 py-3 text-center text-sm font-medium"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-xl bg-[#c30000] px-4 py-3 text-center text-sm font-medium text-white"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
