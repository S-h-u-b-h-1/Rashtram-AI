import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ClientShell } from "@/components/ClientShell";

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

export const metadata = {
  title: {
    default: "Rashtram AI | Legislative & Public Policy Intelligence",
    template: "%s | Rashtram AI",
  },
  description:
    "Research Parliament and State Bills, Acts, Gazette notifications, policies, schemes, guidelines, and public records with source-grounded AI.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable}`}
    >
      <body className="antialiased">
        <ClientShell>{children}</ClientShell>
        <Analytics />
      </body>
    </html>
  );
}
