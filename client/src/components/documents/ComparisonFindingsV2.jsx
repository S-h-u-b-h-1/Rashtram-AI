"use client";

import Link from 'next/link';
import { sourceHref } from '@/lib/comparison-presentation.mjs';

const labels = {
  AMENDS: ['Before', 'After', 'What changed', 'Why it matters'],
  ADDENDUM_TO: ['Before', 'After', 'What changed', 'Why it matters'],
  BILL_TO_ACT: ['Bill', 'Enacted Act', 'Difference', 'Why it matters'],
  RULE_UNDER_ACT: ['Parent Act', 'Rule', 'Operational detail', 'Practical effect'],
  CIRCULAR_UNDER_PARENT: ['Parent requirement', 'Circular / Direction', 'Clarification', 'Practical effect'],
};
export function ComparisonFindingsV2({ result, secondary = false }) {
  const findings = (result.findings || []).filter(f => f.confidenceState === 'VERIFIED' ||
    (f.confidenceState === 'SUPPORTED_LIMITED' && f.limitations?.length));
  return <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
    {!secondary && <section className="surface-card p-5 sm:p-6">
      <p className="text-sm font-semibold text-[#8f1d2c]">{findings.length} verified findings{result.additionalFindings?.length ? ` · ${result.additionalFindings.length} additional findings below` : ''}</p>
      <h3 className="mt-2 font-serif text-2xl text-[#29312d]">At a glance</h3>
      <p className="mt-3 text-sm leading-7 text-[#514d46]">{result.executiveSummary}</p>
      {!findings.length && <div className="mt-4 flex flex-wrap gap-3">
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[#8f1d2c] underline" href="/app/library">Compare different documents</Link>
        {(result.documents || []).map(d => <Link key={d.id} className="inline-flex min-h-11 items-center text-sm text-[#8f1d2c] underline" href={`/app/document/${d.id}`}>View {d.title}</Link>)}
      </div>}
    </section>}
    {findings.map(f => {
      const names = labels[f.relationshipContext] || ['Document A', 'Document B', 'Comparison', 'Why it matters'];
      return <article key={f.id} className="surface-card min-w-0 p-5 sm:p-6">
        <h3 className="font-serif text-xl text-[#8f1d2c]">{f.title}</h3>
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
          {[f.sourceA, f.sourceB].map((side, i) => <div key={i} className="min-w-0 rounded-xl bg-[#f7f2eb] p-4">
            <h4 className="text-xs font-bold text-[#874047]">{names[i]}</h4>
            <p className="mt-2 text-sm leading-7 text-[#514d46]">{side.excerpt.length > 500 ? `${side.excerpt.slice(0, 500)}…` : side.excerpt}</p>
          </div>)}
        </div>
        <h4 className="mt-4 text-sm font-semibold text-[#29312d]">{names[2]}</h4>
        <p className="mt-1 text-sm leading-7 text-[#514d46]">{f.verifiedComparison}</p>
        {f.significance && <><h4 className="mt-4 text-sm font-semibold text-[#29312d]">{names[3]}</h4><p className="mt-1 text-sm leading-7 text-[#514d46]">{f.significance}</p></>}
        <details className="mt-4 border-t border-[#8f1d2c]/10">
          <summary className="cursor-pointer py-3 text-sm font-semibold text-[#8f1d2c]">View evidence</summary>
          {[f, ...(f.supportingFindings || [])].flatMap(member => [member.sourceA, member.sourceB]).map((side, i) => <div key={i} className="mb-4">
            <p className="text-xs font-bold text-[#706a61]">{names[i % 2]} · {side.section || 'Source passage'}</p>
            <blockquote className="my-2 whitespace-pre-wrap border-l-2 border-[#c1a06f] pl-3 text-sm leading-7">{side.excerpt}</blockquote>
            {side.citationIds.map(id => {
              const citation = result.citations?.find(c => (c.id || c.citationId) === id);
              const href = sourceHref(citation);
              return href ? <a key={id} href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs text-[#8f1d2c] underline">{id} · Open source{citation.pageStart ? ` · Page ${citation.pageStart}` : ''}</a> : <span key={id} className="text-xs">{id} · Source link unavailable</span>;
            })}
          </div>)}
        </details>
        {!!f.limitations?.length && <p className="text-xs leading-6 text-[#706a61]">{f.limitations.join(' ')}</p>}
      </article>;
    })}
    {!secondary && !!result.additionalFindings?.length && <details className="surface-card p-5">
      <summary className="cursor-pointer py-3 font-semibold text-[#8f1d2c]">Additional verified findings ({result.additionalFindings.length})</summary>
      <ComparisonFindingsV2 secondary result={{ ...result, findings: result.additionalFindings, additionalFindings: [] }} />
    </details>}
    {!secondary && !!result.limitations?.length && <section className="px-5 text-sm leading-7 text-[#706a61]"><h3 className="font-semibold">Limitations</h3>{result.limitations.map((l, i) => <p key={i}>{l}</p>)}</section>}
  </div>;
}
