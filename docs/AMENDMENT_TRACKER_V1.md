# Amendment Tracker V1

The Amendment Tracker uses the existing source-verified temporal relationships
and preserves document, URL, date-kind, section, page, and version identity.
It exposes a chronological event list, affected section labels where present,
and verbatim before/after passages only when both versions are retrievable.

Publication, notification, effective, and commencement dates remain separate.
Similar titles never establish an amendment. When a historical version or its
text is unavailable, the API returns exactly:

> Historical text unavailable from currently verified sources.

It does not synthesize the missing provision.
