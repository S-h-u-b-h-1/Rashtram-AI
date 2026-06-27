"use client";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import FooterDemo from "../components/Footer";
import { usePathname } from "next/navigation";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  const pathname = usePathname();
  return (
    <html lang="en">
      <AuthProvider>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {pathname === "/login" ||
          pathname === "/signup" ||
          pathname === "/app/bill-chat" ||
          pathname === "/app/act-chat" ||
          pathname === "/app" ? (
            ""
          ) : (
            <Navbar />
          )}
          {children}
          {pathname === "/login" ||
          pathname === "/signup" ||
          pathname === "/app/bill-chat" ||
          pathname === "/app/act-chat" ||
          pathname === "/app" ? (
            ""
          ) : (
            <FooterDemo />
          )}
        </body>
      </AuthProvider>
    </html>
  );
}
