"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import FooterDemo from "@/components/Footer";

export function ClientShell({ children }) {
  const pathname = usePathname();
  const isApplicationRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/app");

  return (
    <AuthProvider>
      {!isApplicationRoute && <Navbar />}
      {children}
      {!isApplicationRoute && <FooterDemo />}
    </AuthProvider>
  );
}
