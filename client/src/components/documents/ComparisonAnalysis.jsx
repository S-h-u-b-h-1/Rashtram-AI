"use client";

import { comparisonSections, comparisonStatus, displayText, sourceHref } from '@/lib/comparison-presentation.mjs';
import { ComparisonFindingsV2 } from './ComparisonFindingsV2';

function EvidenceLinks({ ids = [], citations }) {
  return <span className="mt-2 flex flex-wrap gap-2">{Array.isArray(ids) && ids.map(id => {
    const citation = citations.find(item => item.id === id);
    const href = sourceHref(citation);
    return href ? <a key={id} href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs font-semibold text-[#8f1d2c] underline" aria-label={`Evidence ${id}, opens original source`}>{id}</a> : <span key={id} className="text-xs text-[#706a61]">{id} · source link unavailable</span>;
  })}</span>;
}

function Findings({ section, citations }) {
  return <section className="min-w-0 py-5" aria-labelledby={`comparison-${section.key}`}>
    <h3 id={`comparison-${section.key}`} className="font-serif text-xl text-[#8f1d2c]">{section.title}</h3>
    <div className="mt-3 space-y-4">{section.items.map((item, index) => <article key={index} className="min-w-0 rounded-xl bg-[#f7f2eb] p-4 text-sm leading-6 text-[#514d46] [overflow-wrap:anywhere]">
      {section.key === 'differences' && typeof item === 'object' && (item.documentA || item.documentB) ? <>
        <h4 className="font-semibold text-[#29312d]">{displayText(item.topic || item.dimension) || `Difference ${index + 1}`}</h4>
        <dl className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">
          <div><dt className="text-xs font-semibold text-[#874047]">Document A</dt><dd>{displayText(item.documentA) || 'Insufficient evidence in the selected sources.'}</dd></div>
          <div><dt className="text-xs font-semibold text-[#874047]">Document B</dt><dd>{displayText(item.documentB) || 'Insufficient evidence in the selected sources.'}</dd></div>
        </dl>
        <p className="mt-3"><span className="font-semibold">Why it matters: </span>{displayText(item.whyItMatters || item.significance || item.analysis || item.impact) || 'No supported implication was provided.'}</p>
      </> : <p className="whitespace-pre-wrap">{displayText(item)}</p>}
      <EvidenceLinks ids={item?.citations} citations={citations} />
    </article>)}</div>
  </section>;
}

export function ComparisonAnalysis({ result }) {
  if (result.comparisonSchemaVersion === 'comparison-findings-v2') return <ComparisonFindingsV2 result={result} />;
  const status = comparisonStatus(result);
  const sections = comparisonSections(result);
  const supported = sections.filter(section => section.items.length);
  const missing = sections.filter(section => !section.items.length && section.state !== 'not_applicable');
  const inapplicable = sections.filter(section => section.state === 'not_applicable');
  const citations = result.citations || [];
  const limitations = (Array.isArray(result.limitations) ? result.limitations : [result.limitations]).map(displayText).filter(Boolean);
  return <>
    <section className="surface-card min-w-0 p-5 sm:p-6 [overflow-wrap:anywhere]">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#874047]">Analysis</p>
      <h3 className="mt-2 font-serif text-2xl text-[#8f1d2c]">Executive summary</h3>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#514d46]">{result.generationMode === 'extractive_fallback' ? 'A complete AI comparison was not produced. Retrieved passages are available under Supporting evidence; they are not comparative findings.' : displayText(result.executiveSummary) || 'Insufficient evidence in the selected sources.'}</p>
      {supported.filter(section => ['differences', 'whatChanged', 'practicalImplications'].includes(section.key)).map(section => <Findings key={section.key} section={section} citations={citations} />)}
      {supported.some(section => !['differences', 'whatChanged', 'practicalImplications'].includes(section.key)) && <details className="mt-4 border-t border-[#8f1d2c]/10">
        <summary className="cursor-pointer py-4 font-serif text-xl text-[#8f1d2c]">Detailed comparison</summary>
        {supported.filter(section => !['differences', 'whatChanged', 'practicalImplications'].includes(section.key)).map(section => <Findings key={section.key} section={section} citations={citations} />)}
      </details>}
      {missing.length > 0 && <div className="mt-4 rounded-xl bg-[#f7f2eb] p-4 text-sm leading-6 text-[#625d55]">
        <h3 className="font-semibold">{status.key === 'insufficient' ? 'What is missing' : 'Evidence gaps'}</h3>
        <p>Insufficient evidence in the selected sources.</p>
        <details className="mt-2"><summary className="cursor-pointer py-2 text-xs text-[#8f1d2c]">View {missing.length} areas needing evidence</summary><p className="text-xs leading-6">{missing.map(section => section.title).join(' · ')}</p></details>
      </div>}
      {inapplicable.length > 0 && <details className="mt-3 text-sm text-[#706a61]"><summary className="cursor-pointer py-3">Not materially applicable to this comparison</summary><p>{inapplicable.map(section => section.title).join(' · ')}</p></details>}
    </section>
    <section className="surface-card min-w-0 p-5 sm:p-6 [overflow-wrap:anywhere]">
      <details>
        <summary className="cursor-pointer py-2 font-serif text-xl text-[#8f1d2c]">Supporting evidence · {citations.length} passages</summary>
        <p className="my-3 text-sm leading-6 text-[#706a61]">Original retrieved passages, not AI comparative analysis. Open a passage to inspect its source and location.</p>
        {citations.map(citation => <details key={citation.id} id={`source-${citation.id}`} className="border-t border-[#8f1d2c]/10 py-2">
          <summary className="cursor-pointer py-3 text-sm font-medium text-[#514d46]">{citation.id} · {citation.documentTitle || 'Source document'}{citation.page ? ` · Page ${citation.page}` : ''}</summary>
          <p className="text-xs text-[#706a61]">{citation.sectionPath?.join(' › ') || citation.heading || citation.section}</p>
          <blockquote className="my-3 border-l-2 border-[#c1a06f] pl-3 text-sm leading-7 text-[#625d55]">{citation.snippet || citation.content || 'Passage text is unavailable.'}</blockquote>
          {sourceHref(citation) ? <a href={sourceHref(citation)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs font-semibold text-[#8f1d2c] underline">Open original source {citation.id}</a> : <p className="text-xs text-[#706a61]">Original source link unavailable.</p>}
        </details>)}
        {!citations.length && <p className="text-sm text-[#706a61]">No source passages were saved with this comparison.</p>}
      </details>
    </section>
    <section className="px-5 py-3 text-sm leading-6 text-[#706a61]">
      <h3 className="font-semibold text-[#514d46]">Limitations</h3>
      <ul className="mt-2 space-y-2">{(limitations.length ? limitations : ['Review the original sources and their applicability before relying on this comparison.']).map((text, index) => <li key={index}>{text}</li>)}</ul>
    </section>
  </>;
}
