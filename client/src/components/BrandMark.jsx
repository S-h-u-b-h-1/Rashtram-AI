import Image from "next/image";
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
        "inline-flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a85a52]",
        className,
      )}
      aria-label="Rashtram AI home"
    >
      <span
        className={cn(
          "relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border p-1",
          inverse
            ? "border-white/20 bg-white/95"
            : "border-[#8f1d2c]/10 bg-white/70",
        )}
      >
        <Image
          src="/rashtram-ai-shield.png"
          alt="Rashtram AI"
          width={32}
          height={32}
          sizes="32px"
          className="h-8 w-8 object-contain"
          priority
        />
      </span>
      {!compact && (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-[-0.02em]",
            inverse ? "text-white" : "text-[#8f1d2c]",
          )}
        >
          Rashtram <span className="font-normal opacity-60">AI</span>
        </span>
      )}
    </Link>
  );
}
