# Document processing retention policy

PostgreSQL remains the canonical store for catalogue metadata, current resource metadata, current searchable chunks, capability readiness, relationships, user data, recent processing state, and queryable operational metrics.

Large immutable payloads—downloaded source files, raw HTML, OCR text, and full extraction artifacts—belong in configured object storage under content-addressed keys. Database rows retain the checksum, object key, provenance, verification state, and current searchable representation.

Processing attempts and stage history are evidence for reliability investigations. They must not be deleted during ordinary processing. A future retention run may archive old completed attempt details after 90 days and retain aggregate metrics, but failed/dead-letter history and the most recent successful attempt for every document must remain queryable. Any destructive cleanup requires a verified object-storage checksum and an explicit operator action; no migration in Phase 1 deletes production payloads automatically.

Resource, extracted-text, chunk, and embedding-input hashes are populated incrementally as documents pass through the pipeline. Existing documents continue to work while hash coverage grows.
