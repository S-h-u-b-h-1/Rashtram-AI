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
    eyebrow: "Understand",
    title: "Turn dense documents into clear briefs",
    description:
      "Move from hundreds of pages to a structured view of purpose, provisions, timelines, and implementation.",
    color: "bg-[#e8d7bc] text-[#814731]",
  },
  {
    icon: MessageSquareText,
    eyebrow: "Interrogate",
    title: "Ask questions grounded in the text",
    description:
      "Explore legislation and policy conversationally while keeping every answer anchored to original document context.",
    color: "bg-[#d8e5df] text-[#285e50]",
  },
  {
    icon: Network,
    eyebrow: "Connect",
    title: "See policy in its wider landscape",
    description:
      "Trace related legislation, recurring themes, and the practical relationships between policy instruments.",
    color: "bg-[#ecd8d4] text-[#913d31]",
  },
];

const workflow = [
  {
    number: "01",
    title: "Choose a public record",
    description:
      "Search Parliament and State legislation, Gazette notifications, policies, schemes, and reports.",
  },
  {
    number: "02",
    title: "Build an evidence brief",
    description:
      "Rashtram AI reads, structures, and indexes the source document.",
  },
  {
    number: "03",
    title: "Research conversationally",
    description:
      "Ask precise follow-ups, inspect the summary, and return to the source.",
  },
];

const useCases = [
  "Legislative research",
  "Policy impact analysis",
  "Implementation planning",
  "Academic study",
  "Civic understanding",
  "Institutional memory",
];

const dataTrustPrinciples = [
  {
    title: "Verified public records",
    description:
      "Government-verified public legislative data is complemented by trusted legislative references.",
  },
  {
    title: "Provenance retained",
    description:
      "Source identity, update timestamps, and original record links are retained for audit and citation.",
  },
  {
    title: "Duplicate-safe catalogue",
    description:
      "Legal identifiers, document fingerprints, and hashes are used to reconcile records across repositories.",
  },
  {
    title: "Original record prevails",
    description:
      "Rashtram AI is a research aid, not a legal authority. Original government and public records remain the final reference.",
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
              Evidence-first public policy intelligence
            </div>

            <h1 className="mt-7 max-w-3xl font-serif text-[clamp(3.5rem,7.4vw,6.9rem)] leading-[0.91] tracking-[-0.055em] text-[#8f1d2c]">
              Read policy.
              <br />
              <span className="text-[#8c4548]">Trace impact.</span>
              <br />
              Ask better questions.
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-[#69635a] sm:text-lg sm:leading-8">
              Rashtram AI turns India&apos;s legislation and public policy
              records into a living research workspace—clear summaries,
              grounded conversations, and connected institutional context.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8f1d2c] px-6 py-3.5 text-sm font-semibold text-[#fffaf0] shadow-[0_14px_35px_rgba(143, 29, 44,0.18)] transition hover:-translate-y-0.5 hover:bg-[#2c3833]"
              >
                Explore the workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#workflow"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#8f1d2c]/12 bg-white/65 px-6 py-3.5 text-sm font-semibold text-[#8f1d2c] transition hover:bg-white"
              >
                See how it works
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-[#6f695f]">
              {[
                "Source-grounded answers",
                "Legislation, Gazette and policy",
                "Private workspace",
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
          <span>Built for India&apos;s policy ecosystem</span>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[#3f4742]">
            <span>Parliament & State law</span>
            <span>Gazette notifications</span>
            <span>Policies & schemes</span>
            <span>Official public records</span>
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
                Built for careful work
              </p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.03] tracking-[-0.035em] text-[#8f1d2c] sm:text-5xl">
                Policy intelligence without the black box.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-[#706a61] lg:justify-self-end">
              The interface is designed around the way researchers actually
              work: scan the landscape, focus on a source, ask iterative
              questions, and retain the thread.
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
                Data Trust
              </p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.03] tracking-[-0.035em] text-[#8f1d2c] sm:text-5xl">
                Trust the record, not a black box.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-[#706a61] lg:justify-self-end">
              Rashtram AI maintains a continuously refreshed public legislative
              catalogue while preserving provenance, deduplicating overlapping
              records, and clearly separating research assistance from legal
              authority.
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
              From source to insight
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.035em] text-[#8f1d2c] sm:text-5xl">
              A calmer way through complex policy.
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
              One research environment
            </p>
            <h2 className="mt-5 max-w-xl font-serif text-4xl leading-[1.04] tracking-[-0.035em] sm:text-5xl">
              Designed for every serious policy question.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/58">
              Whether you are comparing statutes or preparing an implementation
              note, Rashtram keeps the source, analysis, and conversation
              together.
            </p>
            <Link
              href="/signup"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#fffaf0] px-6 py-3.5 text-sm font-semibold text-[#8f1d2c] transition hover:-translate-y-0.5"
            >
              Start a research workspace
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
