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
  metadataBase: new URL("https://rashtram-ai.vercel.app"),
  applicationName: "Rashtram AI",
  title: {
    default: "Rashtram AI",
    template: "%s | Rashtram AI",
  },
  description:
    "Search Indian laws, Bills, Gazette notifications and policy documents. Get cited summaries, document chat, comparisons and saved research threads.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Rashtram AI",
    title: "Rashtram AI",
    description:
      "A research workspace for Indian legislation and public policy documents.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Rashtram AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rashtram AI",
    description:
      "A research workspace for Indian legislation and public policy documents.",
    images: ["/twitter-image.png"],
  },
  other: {
    "msapplication-TileColor": "#8f1d2c",
    "msapplication-TileImage": "/mstile-150x150.png",
    "msapplication-config": "/browserconfig.xml",
  },
};

export const viewport = {
  themeColor: "#8f1d2c",
  colorScheme: "light",
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
