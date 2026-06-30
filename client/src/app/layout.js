"use client";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import FooterDemo from "../components/Footer";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const isApplicationRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/app");

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}
      >
        <AuthProvider>
          {!isApplicationRoute && <Navbar />}
          {children}
          {!isApplicationRoute && <FooterDemo />}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
