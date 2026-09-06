"use client";
import { useState } from 'react';

const categoryFor = (source) => {
  if (source.publisherGroup === 'academic') return 'Universities & academic research';
  if (source.publisherGroup === 'think-tank' || /research-|policy-edge|prs-india/.test(source.key)) return 'Institutional research';
  if (source.key.startsWith('regulator-')) return 'Regulators';
  if (/ministry/.test(source.key)) return 'Ministries';
  if (/sansad|sabha|legislature/.test(source.key)) return 'Legislatures';
  if (/state/.test(source.key)) return 'States & UTs';
  return 'Government publications';
};
const date = (value) => value && !Number.isNaN(Date.parse(value))
  ? new Date(value).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : 'Not recorded';

export function SourceCatalogue({ sources = [] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All sources');
  const [ministrySearch, setMinistrySearch] = useState('');
  const ministries = sources.flatMap((source)=>source.onboardingEntries || []);
  const filteredMinistries = ministries.filter((entry)=>`${entry.ministry} ${entry.operationalStatus}`.toLowerCase().includes(ministrySearch.trim().toLowerCase()));
  const categories = ['All sources', ...new Set(sources.map(categoryFor))];
  const visible = sources.filter((source) => (category === 'All sources' || categoryFor(source) === category)
    && `${source.label} ${source.key} ${source.purpose}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <section aria-label="Source classification" className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="min-w-0 flex-1 text-sm font-medium">Find a publisher
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ministries, regulators or research institutions" className="mt-2 min-h-12 w-full rounded-xl border border-[#ded5c8] bg-white px-4" />
      </label>
      <label className="min-w-0 text-sm font-medium">Source type
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-[#ded5c8] bg-white px-4">{categories.map((item) => <option key={item}>{item}</option>)}</select>
      </label>
    </div>
    <p role="status" className="text-sm text-[#706a61]">{visible.length} publishers · Collection status does not establish evidence readiness.</p>
    {!visible.length && <p className="rounded-xl border p-6">No publishers match these filters.</p>}
    <div className="grid gap-4 xl:grid-cols-2">{visible.map((source) => <article key={source.key} className="min-w-0 rounded-2xl border border-[#ded5c8] bg-[#fbf9f5] p-5">
      <p className="text-xs text-[#706a61]">{categoryFor(source)}</p>
      <h3 className="mt-2 text-lg font-semibold text-[#29312d]">{source.label}</h3>
      <p className="mt-2 text-sm leading-6 text-[#706a61]">{source.purpose}</p>
      <p className="mt-3 text-sm font-semibold text-[#8f1d2c]">{source.onboardingStatus === 'pilot' ? 'Pilot · not scheduled' : source.status || 'Not checked'}</p>
      {source.acceptance && <p className="mt-2 text-sm leading-6 text-[#706a61]">{source.acceptance.decision.replaceAll('_',' ')} — {source.acceptance.reason}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        {[['Last attempt',date(source.lastAttempt)], ['Last successful collection',date(source.lastSuccess)], ['Newest catalogued publication',date(source.lastDocumentSeen)], ['New records in last run',source.lastRunNewRecords ?? 'Not recorded'], ['Updated in last run',source.lastRunUpdatedRecords ?? 'Not recorded'], ['Errors in last run',source.latestRunStatus ? source.errorCount ?? 'Not recorded' : 'Not recorded']].map(([label,value]) => <div key={label}><dt className="text-xs text-[#706a61]">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
      </dl>
      {source.errorSummary && <p className="mt-4 break-words rounded-lg bg-[#f5e8e5] p-3 text-sm text-[#85434a]">{source.errorSummary}</p>}
      {source.sourceUrl && /^https:\/\//.test(source.sourceUrl) && <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center text-sm text-[#8f1d2c] underline">Visit publisher</a>}
    </article>)}</div>
    {ministries.length > 0 && <details className="min-w-0 rounded-2xl border border-[#ded5c8] p-4">
      <summary className="cursor-pointer py-3 font-semibold">Ministry & department onboarding · {ministries.length} entries</summary>
      <p className="my-3 text-sm leading-6 text-[#706a61]">Directory discovery is not an active collector. Only separately accepted adapters may collect on a schedule.</p>
      <label className="block text-sm font-medium">Find a ministry or onboarding state<input value={ministrySearch} onChange={(event)=>setMinistrySearch(event.target.value)} className="my-3 min-h-12 w-full rounded-xl border border-[#ded5c8] bg-white px-3" /></label>
      <p role="status" className="mb-4 text-sm">{filteredMinistries.length} matching entries</p>
      <div className="grid gap-3 lg:grid-cols-2">{filteredMinistries.map((entry)=><article key={entry.key} className="min-w-0 rounded-xl border border-[#ded5c8] p-4">
        <h3 className="font-semibold">{entry.ministry}</h3><p className="my-2 text-sm text-[#8f1d2c]">{entry.operationalStatus.replaceAll('_',' ')}</p>
        <p className="text-sm">{entry.officialDomain || 'Official portal needs verification'}</p>
        <p className="my-2 text-sm text-[#706a61]">Last attempt: {date(entry.lastAttempt)} · Last collection: {date(entry.lastSuccess)}</p>
        {entry.failureDetail && <p className="break-words text-sm text-[#85434a]">{entry.failureType}: {entry.failureDetail}</p>}
        <ul className="mt-3 space-y-2 text-sm">{entry.sections.map((section)=><li key={section.url} className="break-words"><a className="text-[#8f1d2c] underline" href={section.url} target="_blank" rel="noreferrer">{section.title}</a> · {section.sectionType}{section.audit && <p className="text-[#706a61]">{section.audit.status.replaceAll('_',' ')} · {section.audit.downloadableCandidates ?? 0} candidate links</p>}</li>)}</ul>
      </article>)}</div>
      {!filteredMinistries.length && <p className="py-4 text-sm">No ministry entries match this search.</p>}
    </details>}
  </section>;
}
