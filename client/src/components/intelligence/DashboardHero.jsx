import Link from "next/link";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  BookOpenText,
  Clock3,
  FileSearch,
  Search,
  GitCompareArrows,
} from "lucide-react";
import { useState } from "react";
import { formatDate, formatRelativeTime } from "@/lib/document-links";

export function DashboardHero({ data, onSearch }) {
  const [query, setQuery] = useState("");
  const pointerX = useMotionValue(560);
  const pointerY = useMotionValue(180);
  const smoothX = useSpring(pointerX, { stiffness: 90, damping: 28 });
  const smoothY = useSpring(pointerY, { stiffness: 90, damping: 28 });
  const cursorGlow = useMotionTemplate`radial-gradient(520px circle at ${smoothX}px ${smoothY}px, rgba(255, 250, 240, 0.13), transparent 58%)`;

  const updatePointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(event.clientX - bounds.left);
    pointerY.set(event.clientY - bounds.top);
  };

  return (
    <motion.section
      className="relative overflow-hidden rounded-[1.8rem] bg-[#8f1d2c] p-5 text-white shadow-[0_22px_70px_rgba(78,40,31,0.18)] sm:p-6 lg:p-7"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={updatePointer}
    >
      <div className="policy-grid absolute inset-0 opacity-20" />
      <motion.div className="absolute inset-0" style={{ background: cursorGlow }} />
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#a85a52]/18 blur-3xl" />
      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
              <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 font-semibold uppercase tracking-[0.14em] text-[#c1a06f]">
                Research Desk
              </span>
              <span>{formatDate(data.currentDate)}</span>
            </div>
            <h2 className="mt-5 font-serif text-3xl leading-tight tracking-[-0.035em] sm:text-5xl">
              What do you want to understand today?
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/64 sm:text-base">
              Search official Bills, Acts, Gazette records and policy documents.
              Open one record to ask cited questions, or select documents to
              compare.
            </p>
            {data.personalization?.enabled ? (
              <p className="mt-3 max-w-2xl text-xs leading-5 text-white/50">
                Personalized for {data.personalization.role?.replaceAll("_", " ") || "your role"}
                {data.personalization.topics?.length
                  ? ` · ${data.personalization.topics.slice(0, 3).join(", ")}`
                  : ""}
              </p>
            ) : (
              <Link
                href="/app/onboarding"
                className="mt-3 inline-flex rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/72 transition hover:bg-white/12 hover:text-white"
              >
                Personalize this dashboard
              </Link>
            )}
            <form
              className="mt-6 flex max-w-2xl gap-2 rounded-2xl border border-white/12 bg-white/[0.07] p-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (query.trim()) onSearch(query.trim());
              }}
            >
              <Search className="ml-2 mt-3 h-4 w-4 shrink-0 text-white/55" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a topic, ministry, Act, Bill, Gazette or policy"
                className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/40"
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#fffaf0] px-4 text-xs font-semibold text-[#8f1d2c]"
              >
                Search
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/82">
              <Clock3 className="h-4 w-4 text-[#c1a06f]" />
              Source freshness
            </div>
            <p className="mt-3 font-serif text-2xl">
              {data.freshnessStatus.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/42">
              Last refresh {formatRelativeTime(data.lastRefresh)}
            </p>
            <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-white/50">
              {data.briefSummary}
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/[0.055] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c1a06f]">
              Simple research flow
            </p>
            <div className="mt-3 grid gap-2 text-xs text-white/68">
              {["Search the record", "Open and ask cited questions", "Compare only research-ready documents"].map(
                (step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-2 rounded-xl bg-white/[0.055] px-3 py-2"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#fffaf0] text-[10px] font-bold text-[#8f1d2c]">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 xl:col-span-2">
          {[
            {
              label: "Search all documents",
              hint: "Find the right record first",
              href: "/app?view=documents",
              icon: FileSearch,
            },
            {
              label: "Continue reading",
              hint: "Pick up recent work",
              href: "#continue-research",
              icon: BookOpenText,
            },
            {
              label: "Compare documents",
              hint: "Compare two to five records",
              href: "/app/compare",
              icon: GitCompareArrows,
            },
          ].map(({ label, hint, href, icon: Icon }) => (
            <motion.div
              key={href}
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
            >
              <Link
                href={href}
                className="block h-full rounded-2xl border border-white/12 bg-white/[0.065] p-3 text-left transition hover:bg-white/12 hover:text-white"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-white/82">
                  <Icon className="h-3.5 w-3.5 text-[#c1a06f]" />
                  {label}
                </span>
                <span className="mt-1 block text-[11px] text-white/45">
                  {hint}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
