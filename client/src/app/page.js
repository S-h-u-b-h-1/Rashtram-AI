import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Braces,
  Check,
  FileSearch,
  Landmark,
  MessageSquareText,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PolicyVisual } from "@/components/PolicyVisual";

const capabilities = [
  {
    icon: FileSearch,
    eyebrow: "Find",
    title: "Find the right document",
    description:
      "Search Bills, Acts, Gazette notifications, policies, schemes and reports without moving across many websites.",
    color: "bg-[#e8d7bc] text-[#814731]",
  },
  {
    icon: MessageSquareText,
    eyebrow: "Understand",
    title: "Understand it quickly",
    description:
      "Get a simple summary, key points, affected institutions, timelines, risks and source links before reading the full PDF.",
    color: "bg-[#d8e5df] text-[#285e50]",
  },
  {
    icon: Network,
    eyebrow: "Compare",
    title: "Compare before you write",
    description:
      "Ask questions on one document or compare multiple records. Keep citations attached where sources are available.",
    color: "bg-[#ecd8d4] text-[#913d31]",
  },
];

const workflow = [
  {
    number: "01",
    title: "Search what you are studying",
    description:
      "Look up a topic, ministry, law, Gazette notification, policy or scheme.",
  },
  {
    number: "02",
    title: "Open the document",
    description:
      "See the summary, key provisions, affected institutions, risks and links to the original source.",
  },
  {
    number: "03",
    title: "Ask, compare and save",
    description:
      "Ask follow-up questions, compare documents and keep the research thread for later.",
  },
];

const useCases = [
  "Bill tracking",
  "Policy briefs",
  "Implementation notes",
  "Think tank reports",
  "Literature reviews",
  "Institutional memory",
];

const dataTrustPrinciples = [
  {
    title: "Official and trusted sources",
    description:
      "Rashtram AI works with public laws, Bills, Gazette notifications, policies and trusted policy references.",
  },
  {
    title: "Citations stay attached",
    description:
      "Summaries, answers and comparisons keep links to the source record wherever available.",
  },
  {
    title: "A cleaner research catalogue",
    description:
      "Related records, repeated documents and document updates are organised so teams can avoid manual tracking.",
  },
  {
    title: "The original record remains final",
    description:
      "Rashtram AI helps research teams work faster. Official source documents remain the final reference.",
  },
];

export default function Home() {
  return (
    <main className="overflow-hidden bg-[#f6f2eb]">
      <section className="relative px-5 pb-24 pt-32 sm:px-8 sm:pt-36 lg:pb-32 lg:pt-40">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_15%,rgba(168, 90, 82,0.13),transparent_28%),radial-gradient(circle_at_10%_55%,rgba(61,118,105,0.1),transparent_25%)]" />
        <div className="mx-auto grid max-w-[1240px] items-center gap-16 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8f1d2c]/10 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#59544c] shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#9b554f]" />
              For researchers, policy teams and think tanks
            </div>

            <h1 className="mt-7 max-w-3xl font-serif text-[clamp(3.5rem,7.4vw,6.9rem)] leading-[0.91] tracking-[-0.055em] text-[#8f1d2c]">
              Search policy.
              <br />
              <span className="text-[#8c4548]">Get answers.</span>
              <br />
              Write faster.
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-[#69635a] sm:text-lg sm:leading-8">
              Rashtram AI helps research teams work with Indian laws, Bills,
              Gazette notifications, policies and reports. Search documents,
              ask cited questions, compare records and save your research in
              one workspace.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8f1d2c] px-6 py-3.5 text-sm font-semibold text-[#fffaf0] shadow-[0_14px_35px_rgba(143, 29, 44,0.18)] transition hover:-translate-y-0.5 hover:bg-[#2c3833]"
              >
                Open research workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#workflow"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#8f1d2c]/12 bg-white/65 px-6 py-3.5 text-sm font-semibold text-[#8f1d2c] transition hover:bg-white"
              >
                See how it helps
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-[#6f695f]">
              {[
                "Cited answers",
                "Original source links",
                "Document comparison",
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-[#39715f]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <PolicyVisual />
        </div>
      </section>

      <section className="border-y border-[#8f1d2c]/8 bg-[#f3ede2] px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#777065]">
          <span>Built for researchers, policy teams and think tanks</span>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[#3f4742]">
            <span>Search</span>
            <span>Summarise</span>
            <span>Ask</span>
            <span>Compare</span>
            <span>Save</span>
          </div>
        </div>
      </section>

      <section
        id="capabilities"
        className="px-5 py-24 sm:px-8 lg:py-32"
      >
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c4548]">
                What you get
              </p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.03] tracking-[-0.035em] text-[#8f1d2c] sm:text-5xl">
                Less manual search. More useful output.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-[#706a61] lg:justify-self-end">
              Move from a public document to a summary, note, briefing point or
              comparison without losing the source link.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {capabilities.map((capability) => (
              <article
                key={capability.title}
                className="group rounded-[1.7rem] border border-[#8f1d2c]/9 bg-white p-7 shadow-[0_20px_55px_rgba(143, 29, 44,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_75px_rgba(143, 29, 44,0.09)]"
              >
                <div
                  className={`grid h-12 w-12 place-items-center rounded-2xl ${capability.color}`}
                >
                  <capability.icon className="h-5 w-5" />
                </div>
                <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a8277]">
                  {capability.eyebrow}
                </p>
                <h3 className="mt-3 font-serif text-2xl leading-tight tracking-[-0.02em] text-[#8f1d2c]">
                  {capability.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-[#716b62]">
                  {capability.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#8f1d2c]/8 bg-[#f1ece3] px-5 py-24 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c4548]">
                Source clarity
              </p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.03] tracking-[-0.035em] text-[#8f1d2c] sm:text-5xl">
                Keep the original source visible.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-[#706a61] lg:justify-self-end">
              The platform helps you read faster, but the original public
              document remains visible for checking, citation and review.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {dataTrustPrinciples.map((principle) => (
              <article
                key={principle.title}
                className="rounded-2xl border border-[#8f1d2c]/9 bg-[#f6f2eb] p-6"
              >
                <ShieldCheck className="h-5 w-5 text-[#34725b]" />
                <h3 className="mt-4 text-base font-semibold text-[#29312d]">
                  {principle.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#716b62]">
                  {principle.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="paper-grid border-y border-[#8f1d2c]/8 px-5 py-24 sm:px-8 lg:py-32"
      >
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c4548]">
              How it works
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.035em] text-[#8f1d2c] sm:text-5xl">
              Start with a document. Leave with a usable note.
            </h2>
          </div>

          <div className="relative mt-16 grid gap-6 lg:grid-cols-3">
            <div className="absolute left-[16%] right-[16%] top-7 hidden border-t border-dashed border-[#8f1d2c]/20 lg:block" />
            {workflow.map((step) => (
              <article key={step.number} className="relative text-center">
                <div className="relative z-10 mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#8f1d2c]/12 bg-[#f6f2eb] font-mono text-xs font-semibold text-[#8c4548] shadow-sm">
                  {step.number}
                </div>
                <h3 className="mt-7 font-serif text-2xl text-[#8f1d2c]">
                  {step.title}
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#706a61]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#8f1d2c] px-5 py-24 text-white sm:px-8 lg:py-32">
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c1a06f]">
              For research teams
            </p>
            <h2 className="mt-5 max-w-xl font-serif text-4xl leading-[1.04] tracking-[-0.035em] sm:text-5xl">
              Turn public documents into research notes.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/58">
              Prepare policy notes, compare records, track changes and return
              to saved research with citations intact.
            </p>
            <Link
              href="/signup"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#fffaf0] px-6 py-3.5 text-sm font-semibold text-[#8f1d2c] transition hover:-translate-y-0.5"
            >
              Open your workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {useCases.map((useCase, index) => {
              const icons = [
                Search,
                Braces,
                Landmark,
                BookOpenCheck,
                ShieldCheck,
                Sparkles,
              ];
              const Icon = icons[index];
              return (
                <div
                  key={useCase}
                  className="glass-panel min-h-36 rounded-2xl p-5"
                >
                  <Icon className="h-5 w-5 text-[#c1a06f]" />
                  <p className="mt-8 text-sm font-medium leading-5 text-white/80">
                    {useCase}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
