"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { DocumentExplorer } from "@/components/documents/DocumentExplorer";
import { LIBRARY_FILTER_KEYS } from "@/lib/research-workspace.mjs";

function Library() {
  const params = useSearchParams();
  return <WorkspaceShell activeKey="documents" title="Library">
    <DocumentExplorer key={params.toString()} initialQuery={params.get("q") || ""} initialFilters={Object.fromEntries(LIBRARY_FILTER_KEYS.filter((key) => params.has(key)).map((key) => [key, params.get(key)]))} title="Find a document" description="Laws, regulations, policies and public records. Choose a source to start researching." />
    <details className="mt-6 text-sm text-[#706a61]"><summary className="cursor-pointer py-3">Specialist libraries & research tools</summary>
      <div className="flex flex-wrap gap-2 py-2">{[['Gazette', '/app/egazette'], ['State Bills', '/app/state-bills'], ['State Acts', '/app/state-acts'], ['Related sources & compliance research', '/app/recommend']].map(([label, href]) => <Link key={href} href={href} className="rounded-lg border border-[#8f1d2c]/10 px-4 py-3 text-xs text-[#8f1d2c]">{label}</Link>)}</div>
    </details>
  </WorkspaceShell>;
}
export default function LibraryPage() { return <ProtectedRoute><Suspense fallback={<p role="status">Opening Library…</p>}><Library /></Suspense></ProtectedRoute>; }
