"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Building2,
  GraduationCap,
  Landmark,
  Newspaper,
  Scale,
} from "lucide-react";

const USE_CASES = [
  {
    icon: Scale,
    title: "Legal and policy research",
    description:
      "Search Bills, Acts, Gazette records, policies, and their official source material from one consistent workspace.",
  },
  {
    icon: Newspaper,
    title: "Legislative reporting",
    description:
      "Trace dates, ministries, jurisdictions, PDFs, and source links before using a record in reporting.",
  },
  {
    icon: Landmark,
    title: "Government research",
    description:
      "Review Parliament and state legislative material while preserving source provenance and document context.",
  },
  {
    icon: GraduationCap,
    title: "Teaching and study",
    description:
      "Build grounded reading lists and ask document-specific questions with citations back to indexed passages.",
  },
  {
    icon: Building2,
    title: "Institutional monitoring",
    description:
      "Use filters, saved searches, collections, and source health to organize recurring public-policy research.",
  },
  {
    icon: BookOpenText,
    title: "Cross-document analysis",
    description:
      "Select up to five catalogue records and compare them in a shared, source-grounded research conversation.",
  },
];

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-[#eee8df] px-5 py-20 sm:py-28">
      <section className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
            Research workflows
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-[#8f1d2c] sm:text-7xl">
            Legislative intelligence with a traceable source.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#706a61]">
            Rashtram AI helps researchers move from discovery to document
            analysis without losing the official public record behind the
            answer.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#8f1d2c] px-5 py-3 text-sm font-semibold text-white"
          >
            Create an account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-3xl border border-[#8f1d2c]/9 bg-[#f8f4ed] p-6"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eee0dc] text-[#8f1d2c]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 font-serif text-2xl text-[#29312d]">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#706a61]">
                {description}
              </p>
            </article>
          ))}
        </div>

        <section className="mt-16 rounded-3xl bg-[#8f1d2c] p-8 text-white sm:p-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
            Research method
          </p>
          <h2 className="mt-3 font-serif text-3xl">Discover. Verify. Research.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Catalogue records retain jurisdiction, authority, dates, document
            type, PDF availability, and source URL. AI responses use indexed
            document passages and remain research assistance—not legal advice
            or a substitute for the official record.
          </p>
        </section>
      </section>
    </main>
  );
}
