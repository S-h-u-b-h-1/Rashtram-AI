import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({
  href = "/",
  compact = false,
  inverse = false,
  className,
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d97745]",
        className,
      )}
      aria-label="Rashtram AI home"
    >
      <span
        className={cn(
          "relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border",
          inverse
            ? "border-white/15 bg-white/10"
            : "border-[#19231f]/10 bg-[#19231f]",
        )}
        aria-hidden="true"
      >
        <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-[#e69a57]" />
        <span className="absolute -bottom-3 -left-2 h-7 w-7 rounded-full bg-[#bd3c2d]" />
        <span
          className={cn(
            "relative font-serif text-lg font-semibold",
            inverse ? "text-white" : "text-[#fffaf0]",
          )}
        >
          R
        </span>
      </span>
      {!compact && (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-[-0.02em]",
            inverse ? "text-white" : "text-[#19231f]",
          )}
        >
          Rashtram <span className="font-normal opacity-60">AI</span>
        </span>
      )}
    </Link>
  );
}
