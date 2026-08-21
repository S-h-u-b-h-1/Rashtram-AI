# Cross-State Comparison V1

The workflow retrieves each selected state independently through the existing
recommendation, hybrid retrieval, and evidence-sufficiency architecture. It
accepts one business/activity/topic and two to five states.

Only documents whose stored state or jurisdiction exactly matches the relevant
state enter that state’s evidence set. Every finding retains its state,
document, page/section where available, and source URL. The output covers
authority, registration, licensing, obligations, prohibitions, penalties,
effective dates, and source documents.

An empty field is labelled `not found in current corpus`. It is never converted
to `does not apply`, and the workflow never asserts a difference unless cited
state-specific evidence establishes it.
