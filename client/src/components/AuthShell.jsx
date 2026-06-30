import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const assurances = [
  "Evidence-linked policy answers",
  "Private research workspace",
  "Legislation, Gazette and policy in one place",
];

export function AuthShell({ eyebrow, title, description, children }) {
  return (
    <main className="min-h-screen bg-[#f0ebe3] lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#8f1d2c] p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="policy-grid absolute inset-0 opacity-20" />
        <div className="absolute -left-28 top-1/3 h-80 w-80 rounded-full bg-[#3e786b]/25 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#a85a52]/20 blur-3xl" />

        <BrandMark inverse className="relative z-10" />

        <div className="relative z-10 my-auto max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c1a06f]">
            {eyebrow}
          </p>
          <h2 className="mt-6 font-serif text-5xl leading-[1.04] tracking-[-0.035em] xl:text-6xl">
            Better policy work starts with better questions.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/62">
            Move from dense documents to a clear, traceable understanding of
            purpose, provisions, impact, and implementation.
          </p>

          <div className="mt-10 grid gap-3">
            {assurances.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 text-sm text-white/78"
              >
                <CheckCircle2 className="h-4 w-4 text-[#c1a06f]" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-white/45">
          <ShieldCheck className="h-4 w-4" />
          Secure access to your research workspace
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[#5f5a52] transition hover:bg-white/60 hover:text-[#8f1d2c] sm:left-8 sm:top-7"
        >
          <ArrowLeft className="h-4 w-4" />
          Back home
        </Link>

        <div className="w-full max-w-[470px]">
          <BrandMark className="mb-10 lg:hidden" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c4548]">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] text-[#8f1d2c] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#706a61]">
            {description}
          </p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
