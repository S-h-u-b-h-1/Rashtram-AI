"use client";

import Link from "next/link";
import { GitCompareArrows, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getDocumentComparisons } from "@/lib/api";
import { formatDate } from "@/lib/document-links";

export function ComparisonHistory() {
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getDocumentComparisons(20)
      .then((response) => active && setComparisons(response.comparisons || []))
      .catch(() => active && setComparisons([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-[#874047]" />
        <h2 className="font-serif text-2xl text-[#8f1d2c]">
          Comparison history
        </h2>
      </div>
      {loading ? (
        <Loader2 className="mt-5 h-5 w-5 animate-spin text-[#8f1d2c]" />
      ) : comparisons.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {comparisons.map((comparison) => (
            <Link
              key={comparison.id}
              href={`/app/compare?comparison=${comparison.id}&ids=${comparison.documentIds.join(",")}`}
              className="rounded-xl border border-[#8f1d2c]/8 bg-[#f7f2eb] p-4 transition hover:border-[#8f1d2c]/20"
            >
              <p className="line-clamp-2 text-sm font-semibold text-[#29312d]">
                {comparison.title}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[#81796e]">
                {comparison.documentIds.length} documents · {comparison.mode} ·{" "}
                {formatDate(comparison.updatedAt)}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#81796e]">
          Completed document comparisons will appear here.
        </p>
      )}
    </section>
  );
}
