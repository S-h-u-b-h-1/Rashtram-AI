# Demo Readiness Report

Date: 30 June 2026

## Readiness decision

Rashtram AI is ready for a controlled live demonstration after the production
deployment and smoke checks recorded in the Final Deployment Report.

## Demo-safe capabilities

- Evidence-first dashboard with grouped recent legislative updates, recent
  research, confidence-gated recommendations, ministry metadata, policy
  updates, and compact source health.
- Universal catalogue search and filters across Bills, State Bills, Acts,
  State Acts, Gazette records, policies, circulars, consultations, guidelines,
  and reports.
- One reusable three-pane document workspace for the original PDF, metadata,
  source, summary, timeline, relationships, related documents, bookmarks,
  notes, export, and grounded chat.
- Hindi, English, bilingual, native-text, and OCR-backed PDF processing with a
  visible controlled failure and retry path.
- Policies are a first-class library with national, state, scheme, guideline,
  memorandum, consultation, circular, framework, report, and white-paper
  views.
- Profile editing, preferences, saved content, collections, activity analytics,
  export, password management, and session management.

## Truthfulness controls

- Null source status is no longer converted to “Published.”
- Recommendations require a preference-match score of at least 3.
- Trends are hidden unless at least three categories have two or more records.
- Decorative confidence percentages and projected product impact claims were
  removed.
- Source states use Fresh, Connected, Stale, Degraded, Blocked, Error, and Not
  Run; “Planned” is not presented as live availability.

## Verification gates

- Backend: 76 passed, 1 intentionally skipped database fixture.
- Frontend lint: passed with no findings.
- Frontend production build: passed.
- Official policy connector health: Connected, parser valid, PDFs discovered.
- Browser: public pages render without console errors, error overlays, or
  horizontal overflow at desktop and 390 px mobile widths.

## Known data limitations to state during the demo

- Historical State Bill sources often omit standardized status and legislature
  fields. The interface labels this honestly.
- Policy coverage is growing from connected official sources and is not claimed
  to be exhaustive.
- AI output is research assistance. The official record remains authoritative.
