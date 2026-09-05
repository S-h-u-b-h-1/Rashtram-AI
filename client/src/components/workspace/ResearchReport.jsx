"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getResearchReport, downloadResearchReportPdf } from "@/lib/api";
import { CitationCard } from "@/components/document-chat/CitationCard";
import { formatDate } from "@/lib/document-links";
import { workspaceHref } from "@/lib/research-workspace.mjs";

const titleFor = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
function ReportValue({ value }) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return <p className="whitespace-pre-wrap text-sm leading-7">{String(value)}</p>;
  if (Array.isArray(value)) return <ul className="list-disc space-y-3 pl-5">{value.map((item, index) => <li key={index}><ReportValue value={item} /></li>)}</ul>;
  const label = value.text || value.name || value.title || value.note;
  return <div className="text-sm leading-7">{label && <p>{label}{value.citations?.length ? ` ${value.citations.map((id) => `[${id}]`).join(' ')}` : ''}</p>}<details className="mt-1 text-xs text-[#706a61]"><summary className="cursor-pointer py-2">Evidence details</summary><dl className="space-y-2">{Object.entries(value).filter(([key]) => !['text', 'name', 'title', 'note'].includes(key)).map(([key, item]) => <div key={key}><dt className="font-semibold">{titleFor(key)}</dt><dd className="break-words">{typeof item === 'object' ? JSON.stringify(item) : String(item)}</dd></div>)}</dl></details></div>;
}
export function ResearchReport({ id }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => { let active = true; getResearchReport(id).then((result) => { if (active) { setReport(result.report || result); setError(''); } }).catch((failure) => { if (active) setError(failure.message || 'We could not load this report. Try again.'); }); return () => { active = false; }; }, [id, revision]);
  if (!report) return <div className="py-10 text-sm text-[#706a61]">{error ? <p role="alert">{error}<button type="button" onClick={() => setRevision((value) => value + 1)} className="min-h-11 px-3 text-[#8f1d2c] underline">Try again</button></p> : <p role="status">Opening saved report…</p>}</div>;
  return <article className="mx-auto max-w-4xl"><Link href="/app/research" className="inline-flex min-h-11 items-center text-xs text-[#8f1d2c]">← My Research</Link><h2 className="mt-4 font-serif text-3xl leading-tight">{report.title}</h2><p className="mt-3 text-xs text-[#706a61]">{formatDate(report.createdAt)} · {report.selectedDocumentIds?.length || 0} Library sources</p><div className="my-6 flex flex-wrap gap-3"><button type="button" disabled={downloading} onClick={async () => { setDownloading(true); try { await downloadResearchReportPdf(report.id); } catch (failure) { setError(failure.message); } finally { setDownloading(false); } }} className="min-h-11 rounded-xl bg-[#8f1d2c] px-4 text-sm text-white disabled:opacity-50">{downloading ? 'Preparing PDF…' : 'Download cited PDF'}</button><Link href={workspaceHref({ documentIds: report.selectedDocumentIds || [], question: report.researchQuestion || '' })} className="flex min-h-11 items-center px-4 text-sm text-[#8f1d2c]">Research these sources</Link></div>{error && <p role="alert" className="my-3 text-sm text-[#85434a]">{error}</p>}
    {Object.entries(report.sections || {}).filter(([key]) => key !== 'sources').map(([key, value]) => <section key={key} className="border-t border-[#8f1d2c]/10 py-6"><h3 className="mb-3 text-base font-semibold">{titleFor(key)}</h3><ReportValue value={value} /></section>)}
    <section className="border-t border-[#8f1d2c]/10 py-6"><h3 className="mb-4 text-base font-semibold">Cited sources</h3><div className="flex flex-wrap gap-2">{(report.evidence || []).map((source, index) => <CitationCard key={source.id || index} source={source} index={index} />)}</div></section>
  </article>;
}
