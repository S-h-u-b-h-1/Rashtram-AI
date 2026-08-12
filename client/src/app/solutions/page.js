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
      "Find Bills, Acts, Gazette records, policies and source links from one workspace.",
  },
  {
    icon: Newspaper,
    title: "Legislative tracking",
    description:
      "Check dates, ministries, jurisdictions, PDFs and source links before using a record.",
  },
  {
    icon: Landmark,
    title: "Government research notes",
    description:
      "Turn Parliament and state material into clear notes with source context attached.",
  },
  {
    icon: GraduationCap,
    title: "Teaching and study",
    description:
      "Build reading lists and ask document-specific questions with citations.",
  },
  {
    icon: Building2,
    title: "Institutional memory",
    description:
      "Save searches, chats and comparisons so teams can continue earlier work.",
  },
  {
    icon: BookOpenText,
    title: "Cross-document analysis",
    description:
      "Compare up to five ready documents and ask follow-up questions in one chat.",
  },
];

export default function SolutionsPage() {
  return (
    <main className="min-h-dvh bg-[#eee8df] px-5 py-16 sm:py-20">
      <section className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
            Research use cases
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-[#8f1d2c] sm:text-7xl">
            Practical tools for policy research teams.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#706a61]">
            Rashtram AI helps researchers find public records, understand them
            quickly, compare them, and keep citations close to the work.
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
          <h2 className="mt-3 font-serif text-3xl">Find. Read. Ask. Cite.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Each record keeps useful details like jurisdiction, authority,
            date, document type, PDF availability and source URL. Rashtram AI is
            a research assistant, not legal advice or a replacement for the
            official record.
          </p>
        </section>
      </section>
    </main>
  );
}
