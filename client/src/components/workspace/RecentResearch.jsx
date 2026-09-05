"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useRecentResearch } from "@/hooks/useRecentResearch";
import { formatDate } from "@/lib/document-links";

export function RecentResearch() {
  const { items, loading, error } = useRecentResearch(4);
  if (loading) return <p role="status" className="py-6 text-sm text-[#706a61]">Loading recent research…</p>;
  return <section aria-label="Recent research" className="mt-10">
    {error && <p role="status" className="mb-3 text-xs text-[#85434a]">{error} <Link href="/app/research" className="underline">Open My Research</Link></p>}
    {items.length > 0 && <><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Recent research</h2><Link href="/app/research" className="p-2 text-xs text-[#8f1d2c]">View all</Link></div>
      <div className="divide-y divide-[#8f1d2c]/10">{items.map((item) => <Link key={item.href} href={item.href} className="group flex min-h-16 items-center gap-4 rounded-lg px-2 py-4 hover:bg-[#f1ece3]">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-[#706a61]">{formatDate(item.updatedAt)} · Resume research</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-[#8f1d2c]" />
      </Link>)}</div></>}
  </section>;
}
