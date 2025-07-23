'use client';
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ChatProvider from "../context/Chatcontext";
import Navbar from "../components/Navbar";
import FooterDemo from "../components/Footer";
import { usePathname } from 'next/navigation';
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
      <ChatProvider>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {pathname === '/chat' || pathname === '/login' || pathname === '/signup' ? '' : <Navbar />}
        {children}
        {pathname === '/chat' || pathname === '/login' || pathname === '/signup' ? '' : <FooterDemo />}
      </body>
      </ChatProvider>
    </html>
  );
}
