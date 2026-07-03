"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import FooterDemo from "@/components/Footer";
import { ComparisonProvider } from "@/context/ComparisonContext";

export function ClientShell({ children }) {
  const pathname = usePathname();
  const isApplicationRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/app");

  return (
    <AuthProvider>
      <ComparisonProvider>
        {!isApplicationRoute && <Navbar />}
        {children}
        {!isApplicationRoute && <FooterDemo />}
      </ComparisonProvider>
    </AuthProvider>
  );
}
