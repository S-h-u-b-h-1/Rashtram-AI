import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const footerLinks = [
  { href: "/product", label: "Product" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="bg-[#c30000] text-white">
      <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-[1.3fr_0.7fr]">
          <div>
            <BrandMark inverse />
            <p className="mt-6 max-w-md text-sm leading-6 text-white/55">
              Evidence-first intelligence for understanding India&apos;s bills,
              acts, and public policy landscape.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 text-sm text-white/65 transition hover:text-white"
              >
                {link.label}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-7 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Rashtram AI</p>
          <p>Built for careful, accountable policy research.</p>
        </div>
      </div>
    </footer>
  );
}
