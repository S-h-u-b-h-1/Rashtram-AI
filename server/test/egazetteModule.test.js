const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildFilters,
  gazetteScope,
  mapGazette,
} = require("../egazette/egazetteService");
const {
  eventTypeForRecord,
  updateEventTypeForRecord,
} = require("../lib/ingestion/core/catalogRepository");

test("Gazette records preserve typed identity, provenance, and PDF state", () => {
  const gazette = mapGazette({
    id: 72,
    canonical_id: "rashtram-gazette-72",
    title: "Motor Vehicles Rules Notification",
    document_type: "notification",
    gazette_identifier: "CG-DL-E-29062026-123456",
    legal_identifier: "G.S.R. 501(E)",
    ministry: "Ministry of Road Transport and Highways",
    department: "Road Transport",
    publication_date: "2026-06-29",
    jurisdiction: "India",
    canonical_source: "egazette",
    canonical_url: "https://egazette.gov.in/example",
    pdf_url: "https://egazette.gov.in/example.pdf",
    source_metadata: {
      notificationNumber: "G.S.R. 501(E)",
      gazetteType: "extraordinary",
    },
    metadata_json: {},
  });

  assert.equal(gazette.id, "72");
  assert.equal(gazette.gazetteNumber, "CG-DL-E-29062026-123456");
  assert.equal(gazette.notificationNumber, "G.S.R. 501(E)");
  assert.equal(gazette.notificationType, "notification");
  assert.equal(gazette.gazetteType, "extraordinary");
  assert.equal(gazette.sourceName, "egazette");
  assert.equal(gazette.hasPdf, true);
});

test("Gazette catalogue filters are parameterized and cover the research UI", () => {
  const filters = buildFilters({
    search: "motor vehicles",
    ministry: "Ministry of Road Transport and Highways",
    department: "Road Transport",
    notificationType: "notification",
    gazetteType: "extraordinary",
    jurisdiction: "India",
    year: "2026",
    publicationFrom: "2026-01-01",
    publicationTo: "2026-06-29",
    source: "egazette",
    hasPdf: "true",
  });

  assert.equal(filters.parameters.length, 10);
  assert.equal(filters.parameters[0], "%motor vehicles%");
  assert.equal(filters.parameters[6], 2026);
  assert.match(filters.where, /d\.title ILIKE \$1/);
  assert.match(filters.where, /d\.ministry = \$2/);
  assert.match(filters.where, /d\.department = \$3/);
  assert.match(filters.where, /d\.document_type = \$4/);
  assert.match(filters.where, /d\.publication_date >= \$8::DATE/);
  assert.match(filters.where, /d\.publication_date <= \$9::DATE/);
  assert.match(filters.where, /d\.pdf_url IS NOT NULL/);
  assert.doesNotMatch(filters.where, /motor vehicles/);
});

test("Gazette scope includes official portal records and Gazette identifiers", () => {
  const scope = gazetteScope("record");
  assert.match(scope, /record\.source_name IN/);
  assert.match(scope, /record\.gazette_identifier IS NOT NULL/);
  assert.match(scope, /record\.document_type = 'gazette'/);
});

test("catalogue search can include IDs found in already indexed PDF text", () => {
  const filters = buildFilters({
    search: "compliance date",
    indexedIds: ["72", "81"],
  });
  assert.deepEqual(filters.parameters, [
    "%compliance date%",
    ["72", "81"],
  ]);
  assert.match(filters.where, /d\.id::TEXT = ANY\(\$2::TEXT\[\]\)/);
});

test("Gazette ingestion emits specific publication and update events", () => {
  assert.equal(
    eventTypeForRecord({
      sourceName: "egazette",
      documentType: "notification",
    }),
    "gazette_notification",
  );
  assert.equal(
    eventTypeForRecord({
      sourceName: "egazette",
      documentType: "rule",
    }),
    "rule_published",
  );
  assert.equal(
    eventTypeForRecord({
      sourceName: "egazette",
      documentType: "order",
    }),
    "government_order",
  );
  assert.equal(
    updateEventTypeForRecord(
      { status: "Published" },
      {
        sourceName: "egazette",
        documentType: "notification",
        status: "Revised",
      },
    ),
    "notification_updated",
  );
});
