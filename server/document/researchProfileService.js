const crypto = require("node:crypto");
const { query } = require("../db");
const { providerConfig, responseText, runGeneration } = require("../lib/vectordb");

const PROFILE_VERSION = "research-profile-v1";
const hash = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const stringValue = (value, maximum = 12_000) =>
  (typeof value === "string" || typeof value === "number")
    ? String(value).normalize("NFKC").trim().slice(0, maximum)
    : "";
const stringList = (value, maximum = 30) => [...new Set((Array.isArray(value) ? value : [])
  .map((item) => stringValue(item, 240))
  .filter(Boolean))].slice(0, maximum);

const parseJsonObject = (value) => {
  const raw = responseText(value) || stringValue(value, 100_000);
  const normalized = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Research profile response was not valid JSON.");
  return JSON.parse(normalized.slice(start, end + 1));
};

const normalizeResearchProfile = (value, fallback = {}) => {
  const profile = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const executiveSummary = stringValue(profile.executiveSummary || fallback.executiveSummary, 8_000);
  const documentPurpose = stringValue(profile.documentPurpose || fallback.documentPurpose || executiveSummary, 2_000);
  if (!executiveSummary || !documentPurpose) throw new Error("Research profile is missing its summary or purpose.");
  return {
    executiveSummary,
    documentPurpose,
    topics: stringList(profile.topics || fallback.topics),
    themes: stringList(profile.themes || fallback.themes),
    industries: stringList(profile.industries || fallback.industries),
    entities: stringList(profile.entities || fallback.entities),
    authorities: stringList(profile.authorities || fallback.authorities),
    regulators: stringList(profile.regulators || fallback.regulators),
    ministries: stringList(profile.ministries || fallback.ministries),
    jurisdictions: stringList(profile.jurisdictions || fallback.jurisdictions),
    importantDates: stringList(profile.importantDates),
    legalInstruments: stringList(profile.legalInstruments),
    keyProvisions: stringList(profile.keyProvisions),
    obligations: stringList(profile.obligations),
    rights: stringList(profile.rights),
    penalties: stringList(profile.penalties),
    implementationTopics: stringList(profile.implementationTopics),
  };
};

const deterministicProfile = (document, evidence) => {
  const compact = stringValue(evidence, 8_000).replace(/\s+/g, " ");
  const summary = compact.slice(0, 1_500) || `${document.title} is catalogued for research.`;
  const purpose = summary.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 700) || summary;
  return normalizeResearchProfile({
    executiveSummary: summary,
    documentPurpose: purpose,
    topics: [document.category, document.document_type].filter(Boolean),
    themes: [document.category].filter(Boolean),
    entities: [document.authority, document.ministry].filter(Boolean),
    authorities: [document.authority].filter(Boolean),
    ministries: [document.ministry].filter(Boolean),
    jurisdictions: [document.jurisdiction, document.state].filter(Boolean),
  });
};

const generateResearchProfile = async ({ document, evidence }) => {
  const fallback = deterministicProfile(document, evidence);
  const prompt = `
Create a compact research-discovery profile for this public-policy document.
Use only the supplied document metadata and evidence. Do not invent a law,
institution, date, duty, penalty, legal relationship, or affected industry.
Return valid JSON only with keys: executiveSummary, documentPurpose, topics,
themes, industries, entities, authorities, regulators, ministries,
jurisdictions, importantDates, legalInstruments, keyProvisions, obligations,
rights, penalties, implementationTopics. Every field after documentPurpose is
an array of short strings. Use an empty array where evidence is absent.

Metadata:
${JSON.stringify({
    title: document.title,
    documentType: document.document_type,
    category: document.category,
    ministry: document.ministry,
    authority: document.authority,
    jurisdiction: document.jurisdiction,
    state: document.state,
    publicationDate: document.publication_date,
  })}

Evidence:
${stringValue(evidence, 28_000)}
`;
  try {
    const response = await runGeneration("generateContent", prompt, {
      useCircuitBreaker: false,
      models: [providerConfig().chatModel],
      maxModels: 1,
      attempts: 1,
      timeoutMs: Number(process.env.RESEARCH_PROFILE_AI_TIMEOUT_MS || 16_000),
      maxQueueWaitMs: Number(process.env.RESEARCH_PROFILE_AI_QUEUE_WAIT_MS || 3_000),
      maxRetryAfterMs: 0,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        maxOutputTokens: Number(process.env.RESEARCH_PROFILE_AI_MAX_OUTPUT_TOKENS || 1_600),
      },
    });
    return { profile: normalizeResearchProfile(parseJsonObject(response), fallback), mode: "generated" };
  } catch (error) {
    return { profile: fallback, mode: "extractive_fallback", error };
  }
};

const loadProfileInput = async (documentId, queryFn = query) => {
  const result = await queryFn(`SELECT document.id, document.title,
      document.document_type, document.category, document.ministry,
      document.authority, document.jurisdiction, document.state,
      document.publication_date, document.content_fingerprint_sha256,
      state.search_ready,
      artifact.english_summary,
      LEFT(COALESCE(artifact.original_text, ''), 30000) AS original_text
    FROM documents document
    JOIN document_processing_state state ON state.document_id = document.id
    LEFT JOIN document_text_artifacts artifact ON artifact.document_id = document.id
    WHERE document.id = $1 AND document.visibility_status = 'public'`, [documentId]);
  const document = result.rows[0] || null;
  if (!document) throw new Error("Document was not found.");
  if (!document.search_ready) throw new Error("Research profiles require a search-ready document.");
  let evidence = stringValue(document.english_summary || document.original_text, 30_000);
  if (!evidence) {
    const chunks = await queryFn(`SELECT original_text, translated_text
      FROM document_text_chunks WHERE document_id = $1
      ORDER BY chunk_index LIMIT 24`, [document.id]);
    evidence = stringValue(chunks.rows.map((row) =>
      row.original_text || row.translated_text || "").filter(Boolean).join("\n\n"), 30_000);
  }
  if (!evidence) throw new Error("No usable evidence is available for the research profile.");
  return { document, evidence };
};

const persistResearchProfile = async ({ document, evidence, profile, queryFn = query }) => {
  const contentHash = document.content_fingerprint_sha256 || hash(evidence);
  const values = [
    document.id, contentHash, profile.executiveSummary, profile.documentPurpose,
    profile.topics, profile.themes, profile.industries, profile.entities,
    profile.authorities, profile.regulators, profile.ministries, profile.jurisdictions,
    profile.importantDates, profile.legalInstruments, profile.keyProvisions,
    profile.obligations, profile.rights, profile.penalties, profile.implementationTopics,
    providerConfig().chatModel, PROFILE_VERSION,
  ];
  await queryFn(`INSERT INTO document_research_profiles (
      document_id, content_hash, executive_summary, document_purpose,
      topics_json, themes_json, industries_json, entities_json, authorities_json,
      regulators_json, ministries_json, jurisdictions_json, important_dates_json,
      legal_instruments_json, key_provisions_json, obligations_json, rights_json,
      penalties_json, implementation_topics_json, model, prompt_version
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,
      $10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,
      $16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20,$21)
    ON CONFLICT (document_id) DO UPDATE SET
      content_hash = EXCLUDED.content_hash,
      executive_summary = EXCLUDED.executive_summary,
      document_purpose = EXCLUDED.document_purpose,
      topics_json = EXCLUDED.topics_json,
      themes_json = EXCLUDED.themes_json,
      industries_json = EXCLUDED.industries_json,
      entities_json = EXCLUDED.entities_json,
      authorities_json = EXCLUDED.authorities_json,
      regulators_json = EXCLUDED.regulators_json,
      ministries_json = EXCLUDED.ministries_json,
      jurisdictions_json = EXCLUDED.jurisdictions_json,
      important_dates_json = EXCLUDED.important_dates_json,
      legal_instruments_json = EXCLUDED.legal_instruments_json,
      key_provisions_json = EXCLUDED.key_provisions_json,
      obligations_json = EXCLUDED.obligations_json,
      rights_json = EXCLUDED.rights_json,
      penalties_json = EXCLUDED.penalties_json,
      implementation_topics_json = EXCLUDED.implementation_topics_json,
      model = EXCLUDED.model, prompt_version = EXCLUDED.prompt_version,
      generated_at = NOW(), updated_at = NOW()
    WHERE document_research_profiles.content_hash <> EXCLUDED.content_hash
       OR document_research_profiles.prompt_version <> EXCLUDED.prompt_version`,
  values.map((value, index) => index >= 4 && index <= 18 ? JSON.stringify(value) : value));
  return contentHash;
};

const ensureResearchProfile = async ({ documentId, queryFn = query, generateFn = generateResearchProfile }) => {
  const startedAt = Date.now();
  const { document, evidence } = await loadProfileInput(documentId, queryFn);
  const contentHash = document.content_fingerprint_sha256 || hash(evidence);
  const existing = await queryFn(`SELECT content_hash, prompt_version
    FROM document_research_profiles WHERE document_id = $1`, [document.id]);
  if (existing.rows[0]?.content_hash === contentHash && existing.rows[0]?.prompt_version === PROFILE_VERSION) {
    return { documentId: String(document.id), status: "unchanged", durationMs: Date.now() - startedAt };
  }
  const generated = await generateFn({ document, evidence });
  await persistResearchProfile({ document, evidence, profile: generated.profile, queryFn });
  return {
    documentId: String(document.id), status: "generated", mode: generated.mode,
    durationMs: Date.now() - startedAt,
    estimatedInputTokens: Math.ceil(evidence.length / 4),
    estimatedOutputTokens: Math.ceil(JSON.stringify(generated.profile).length / 4),
    error: generated.error?.message || null,
  };
};

module.exports = {
  PROFILE_VERSION,
  deterministicProfile,
  ensureResearchProfile,
  generateResearchProfile,
  normalizeResearchProfile,
  parseJsonObject,
  persistResearchProfile,
};
