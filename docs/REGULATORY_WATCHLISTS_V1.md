# Regulatory Watchlists V1

Rashtram AI users can monitor a regulator, ministry, industry, document,
jurisdiction, state, or topic. Watchlists and alerts are private to the account
that created them and are removed during account deletion.

Alerts are generated only from `intelligence_events` records with both a source
name and source URL. Regulator, ministry, state, jurisdiction, and document
watchlists require exact normalized metadata matches. Topic and industry
watchlists use bounded literal text matching against event titles, summaries,
categories, and document types. Vector similarity alone never creates an alert.

Every alert records why it triggered, the official source identity and URL, the
event date when available, and the exact structured metadata used for matching.
The impact line asks the researcher to verify the cited source; it does not infer
legal applicability.
