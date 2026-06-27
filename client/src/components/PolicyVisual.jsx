import {
  BookOpenText,
  CheckCircle2,
  FileSearch,
  Landmark,
  Sparkles,
} from "lucide-react";

const evidence = [
  { label: "Purpose & scope", score: "94%" },
  { label: "Fiscal impact", score: "88%" },
  { label: "Implementation", score: "91%" },
];

export function PolicyVisual({ compact = false }) {
  return (
    <div
      className={`policy-visual relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#19231f] text-white shadow-[0_35px_90px_rgba(20,30,26,0.28)] ${
        compact ? "min-h-[360px]" : "min-h-[520px]"
      }`}
      aria-label="Illustration of Rashtram AI analysing a policy document"
    >
      <div className="policy-grid absolute inset-0 opacity-30" />
      <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-[#d97745]/20 blur-3xl" />
      <div className="absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-[#3d7669]/25 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col p-6 sm:p-8">
        <div className="flex items-center justify-between text-xs text-white/55">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#efb36f]" />
            Live policy workspace
          </span>
          <span className="font-mono">IND / 2026</span>
        </div>

        <div className="mt-9 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d97745] text-white">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                Research question
              </p>
              <p className="mt-1 text-sm font-medium">
                What changes for state-level implementation?
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex flex-1 items-center justify-center">
          <div className="policy-orbit absolute h-64 w-64 rounded-full border border-dashed border-white/15" />
          <div className="policy-orbit policy-orbit-reverse absolute h-44 w-44 rounded-full border border-white/10" />

          <div className="relative z-10 w-[82%] rounded-2xl border border-[#eed0a8]/25 bg-[#fffaf0] p-5 text-[#19231f] shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#f1e6d3]">
                  <Landmark className="h-4 w-4 text-[#a33c2f]" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7d7468]">
                    Evidence brief
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    Implementation analysis
                  </p>
                </div>
              </div>
              <Sparkles className="h-4 w-4 text-[#c46b3d]" />
            </div>

            <div className="mt-5 space-y-3">
              {evidence.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-[#39715f]" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e9dfcf]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#39715f] to-[#6d9a84]"
                      style={{ width: item.score }}
                    />
                  </div>
                  <span className="w-8 font-mono text-[10px] text-[#6c655c]">
                    {item.score}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-[#ddd2c2] pt-4">
              <div className="flex items-center gap-2 text-[11px] text-[#6c655c]">
                <BookOpenText className="h-3.5 w-3.5" />
                Grounded in 14 source passages
              </div>
            </div>
          </div>

          <div className="policy-float absolute left-0 top-[18%] rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] backdrop-blur">
            Clause 7
          </div>
          <div className="policy-float-delayed absolute bottom-[14%] right-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] backdrop-blur">
            Finance note
          </div>
        </div>
      </div>
    </div>
  );
}
