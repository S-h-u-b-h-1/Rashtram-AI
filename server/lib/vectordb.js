const { Pinecone } = require("@pinecone-database/pinecone");

const EMBEDDING_DIMENSION = 768;
const EMBEDDING_BATCH_SIZE = 50;
const EMBEDDING_PROVIDER =
  (process.env.EMBEDDING_PROVIDER || "local").toLowerCase();
const GENERATION_MODEL =
  process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const FALLBACK_GENERATION_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || "gemini-2.0-flash-lite";
const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const VECTOR_NAMESPACE =
  process.env.PINECONE_NAMESPACE ||
  (EMBEDDING_PROVIDER === "local"
    ? "local-hash-v1"
    : `${EMBEDDING_MODEL}-v1`);

let pineconeClient;
let geminiClientPromise;

const getPinecone = () => {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is required");
  }

  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }

  return pineconeClient;
};

const getGemini = async () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required");
  }

  if (!geminiClientPromise) {
    geminiClientPromise = import("@google/genai").then(
      ({ GoogleGenAI }) =>
        new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
    );
  }

  return geminiClientPromise;
};

const normalizeVector = (values) => {
  const magnitude = Math.sqrt(
    values.reduce((sum, value) => sum + value * value, 0),
  );
  if (!magnitude) return values;
  return values.map((value) => value / magnitude);
};

const hashFeature = (feature, seed = 0) => {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let index = 0; index < feature.length; index += 1) {
    hash ^= feature.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
};

const generateLocalEmbedding = (text) => {
  const tokens = String(text)
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
  const features = [...tokens];

  for (let index = 0; index < tokens.length - 1; index += 1) {
    features.push(`${tokens[index]}_${tokens[index + 1]}`);
  }

  const counts = new Map();
  for (const feature of features) {
    counts.set(feature, (counts.get(feature) || 0) + 1);
  }

  const values = new Array(EMBEDDING_DIMENSION).fill(0);
  for (const [feature, count] of counts) {
    const bucket = hashFeature(feature) % EMBEDDING_DIMENSION;
    const sign = hashFeature(feature, 0x9e3779b9) % 2 === 0 ? 1 : -1;
    values[bucket] += sign * (1 + Math.log(count));
  }

  return normalizeVector(values);
};

const createProbeVector = () => {
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);
  vector[0] = 1;
  return vector;
};

const responseText = (response) => {
  if (typeof response?.text === "function") return response.text();
  return response?.text || "";
};

const isTransientGeminiError = (error) => {
  const status = Number(error?.status || error?.code);
  const message = String(error?.message || "");
  return (
    [429, 500, 502, 503, 504].includes(status) ||
    /RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|rate limit|temporar/i.test(
      message,
    )
  );
};

const withGeminiRetry = async (operation, label, attempts = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error) || attempt === attempts) throw error;

      const delay = 1_000 * 2 ** (attempt - 1);
      console.warn(
        `${label} temporarily unavailable; retrying in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

const generationModels = () =>
  [...new Set([GENERATION_MODEL, FALLBACK_GENERATION_MODEL])].filter(Boolean);

const runGeneration = async (method, contents) => {
  const ai = await getGemini();
  let lastError;

  for (const model of generationModels()) {
    try {
      return await withGeminiRetry(
        () => ai.models[method]({ model, contents }),
        `Gemini model ${model}`,
      );
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error)) throw error;
      console.warn(`Gemini model ${model} unavailable; trying fallback`);
    }
  }

  throw lastError;
};

const getIndex = () =>
  getPinecone()
    .index(process.env.PINECONE_INDEX_NAME || "rashtram-bills")
    .namespace(VECTOR_NAMESPACE);

const getActIndex = () =>
  getPinecone()
    .index(process.env.PINECONE_ACT_INDEX_NAME || "rashtram-acts")
    .namespace(VECTOR_NAMESPACE);

const getEGazetteIndex = () =>
  getPinecone()
    .index(
      process.env.PINECONE_EGAZETTE_INDEX_NAME ||
        process.env.PINECONE_ACT_INDEX_NAME ||
        "rashtram-acts",
    )
    .namespace(VECTOR_NAMESPACE);

const checkDocumentExists = async (index, idField, id) => {
  try {
    const queryResults = await index.query({
      vector: createProbeVector(),
      topK: 1,
      filter: { [idField]: { $eq: String(id) } },
      includeMetadata: true,
    });

    const match = queryResults.matches?.[0];
    if (!match) return { exists: false };

    return {
      exists: true,
      summary: match.metadata.summary || null,
      title:
        match.metadata.billTitle ||
        match.metadata.actTitle ||
        match.metadata.title,
      lastProcessed: match.metadata.timestamp,
      chunksCount: match.metadata.totalChunks || "unknown",
    };
  } catch (error) {
    console.error(`Failed to check ${idField}:`, error);
    return { exists: false };
  }
};

const checkBillExists = async (billId) => {
  const result = await checkDocumentExists(getIndex(), "billId", billId);
  return {
    ...result,
    billTitle: result.title,
  };
};

const checkActExists = async (actId) => {
  const result = await checkDocumentExists(getActIndex(), "actId", actId);
  return {
    ...result,
    actTitle: result.title,
  };
};

const checkEGazetteExists = async (gazetteId) => {
  const result = await checkDocumentExists(
    getEGazetteIndex(),
    "gazetteId",
    gazetteId,
  );
  return {
    ...result,
    gazetteTitle: result.title,
  };
};

const generateEmbeddings = async (
  texts,
  taskType = "RETRIEVAL_DOCUMENT",
) => {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  if (EMBEDDING_PROVIDER === "local") {
    return texts.map(generateLocalEmbedding);
  }
  if (EMBEDDING_PROVIDER !== "gemini") {
    throw new Error(
      `Unsupported EMBEDDING_PROVIDER: ${EMBEDDING_PROVIDER}`,
    );
  }

  const ai = await getGemini();
  const response = await withGeminiRetry(
    () =>
      ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts,
        config: {
          outputDimensionality: EMBEDDING_DIMENSION,
          taskType,
        },
      }),
    `Gemini embedding model ${EMBEDDING_MODEL}`,
  );

  const embeddings = response.embeddings || [];
  if (embeddings.length !== texts.length) {
    throw new Error(
      `Gemini returned ${embeddings.length} embeddings for ${texts.length} inputs`,
    );
  }

  return embeddings.map((embedding, index) => {
    const values = embedding.values;
    if (!values?.length) {
      throw new Error(`Gemini returned no values for embedding ${index}`);
    }
    return normalizeVector(values);
  });
};

const generateEmbedding = async (text) =>
  (await generateEmbeddings([text], "RETRIEVAL_QUERY"))[0];

const normalizeResponseLanguage = (value) =>
  String(value || "").toLowerCase().startsWith("hi") ||
  String(value || "").toLowerCase() === "hindi"
    ? "Hindi"
    : "English";

const generateResponse = async (
  prompt,
  context = "",
  { responseLanguage = "English" } = {},
) => {
  const language = normalizeResponseLanguage(responseLanguage);
  const fullPrompt = `
You are Rashtram AI, an assistant for researching Indian legislative, legal,
and Gazette documents. Answer using the supplied document context.

Document context:
${context}

User question:
${prompt}

Give a comprehensive, accessible answer. Clearly state when the context does
not contain enough information. Do not invent provisions, dates, or citations.
When the context contains labels such as [Passage 1], cite the relevant labels
inline. Respond in ${language}. Preserve quoted source text in its original
language and explain it in ${language} when needed.
`;

  return runGeneration("generateContentStream", fullPrompt);
};

const SUMMARY_GUIDANCE = {
  bill: "purpose, clauses, legislative stage, affected groups, fiscal implications, and implementation questions",
  act: "purpose, operative provisions, rights, duties, authorities, enforcement, penalties, commencement, and amendments",
  gazette: "operative change, issuing authority, affected persons, legal basis, compliance dates, obligations, enforcement, and linked instruments",
  notification: "operative change, legal authority, affected persons, compliance dates, obligations, exemptions, and enforcement",
  rule: "enabling Act, delegated powers, procedures, duties, forms, timelines, enforcement, and commencement",
  regulation: "regulator, statutory authority, regulated entities, obligations, reporting, timelines, enforcement, and transitional provisions",
  circular: "issuing authority, audience, instructions, clarification, effective date, compliance action, and referenced law",
  order: "issuing authority, legal basis, operative direction, affected parties, dates, conditions, and appeal or review",
  office_memorandum: "issuing department, administrative purpose, applicable personnel or institutions, instructions, dates, and implementation",
  policy: "objectives, policy instruments, responsible institutions, beneficiaries, funding, implementation, monitoring, and risks",
  consultation_paper: "problem statement, proposals, questions for consultation, affected stakeholders, evidence, alternatives, and response deadline",
  committee_report: "mandate, evidence considered, findings, recommendations, government response, and legislative implications",
  question: "member, ministry, issue raised, answer, data cited, commitments, and follow-up implications",
  debate: "subject, principal arguments, speakers, government position, disagreements, commitments, and legislative context",
  proceeding: "institution, agenda, decisions, motions, votes, referrals, and next steps",
  guideline: "issuing authority, scope, recommended or mandatory actions, standards, implementation, and monitoring",
  scheme: "objective, eligibility, benefits, delivery institutions, funding, application process, monitoring, and timelines",
  strategy_paper: "strategic objective, evidence base, scenarios, priorities, institutional responsibilities, milestones, risks, and evaluation",
  white_paper: "problem definition, evidence, government position, policy options, recommendations, implementation, and unresolved questions",
  discussion_paper: "problem statement, evidence, options, stakeholder questions, trade-offs, and response process",
  manual: "scope, intended users, procedures, responsibilities, controls, forms, escalation paths, and revision history",
  report: "mandate, methodology, evidence, findings, recommendations, limitations, and responsible institutions",
  cabinet_decision: "decision, approving authority, affected ministries, programme or legal impact, funding, timelines, and implementation",
  press_release: "announcement, issuing authority, policy or legislative context, commitments, dates, and linked official instruments",
  government_resolution: "issuing authority, legal or administrative basis, operative resolution, affected institutions, dates, and implementation",
  recommendation: "issuing body, evidence, recommended action, addressee, rationale, implementation, and follow-up",
  ordinance: "necessity, operative provisions, legal effect, duration, replacement legislation, and affected parties",
};

const generateDocumentSummary = async (
  documentType,
  content,
  { sourceLanguage = "und" } = {},
) => {
  const normalizedType = String(documentType || "document")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  const guidance =
    SUMMARY_GUIDANCE[normalizedType] ||
    "purpose, legal effect, authorities, affected persons, obligations, timelines, implementation, enforcement, and related instruments";
  const prompt = `
Prepare a grounded research brief for this Indian legislative or public-policy
document.

Document type: ${normalizedType}
Detected source language: ${sourceLanguage}
Focus on: ${guidance}.

Use only the supplied text. Distinguish facts stated in the document from
reasonable implications. Clearly state "Not identified in the document" when
evidence is absent. Preserve important numbers, dates, sections, authorities,
and defined terms. Do not invent legal provisions or relationships. Write the
brief in English. When translating Hindi terms, retain the important original
Hindi term in parentheses on first use.

Document content:
${content}
`;

  const response = await runGeneration("generateContent", prompt);
  return responseText(response);
};

const generateDashboardOverview = async (evidence) => {
  const prompt = `
Write a concise two-sentence legislative intelligence overview of no more than
70 words. Use only the supplied JSON evidence. Do not call an item recent,
active, important, or recommended unless the evidence explicitly supports it.
Do not infer legal effects. If evidence is sparse, say so plainly.

Evidence:
${JSON.stringify(evidence)}
`;
  const response = await runGeneration("generateContent", prompt);
  return responseText(response).trim().slice(0, 600);
};

const generateBillSummary = (billContent) =>
  generateDocumentSummary("bill", billContent);

const generateActSummary = (actContent) =>
  generateDocumentSummary("act", actContent);

const generateEGazetteSummary = (content) =>
  generateDocumentSummary("gazette", content);

const searchContent = async (index, idField, id, query, topK = 5) => {
  const queryEmbedding = await generateEmbedding(query);
  const searchResults = await index.query({
    vector: queryEmbedding,
    topK,
    filter: { [idField]: { $eq: String(id) } },
    includeMetadata: true,
  });

  return (searchResults.matches || []).map((match) => ({
    ...match,
    relevanceScore: match.score,
    content: match.metadata?.content || "",
    chunkInfo: {
      index: match.metadata?.chunkIndex || 0,
      total: match.metadata?.totalChunks || 1,
      source: match.metadata?.source || "pdf",
    },
  }));
};

const searchSimilarContent = (query, billId, topK = 5) =>
  searchContent(getIndex(), "billId", billId, query, topK);

const searchSimilarContentForAct = (query, actId, topK = 5) =>
  searchContent(getActIndex(), "actId", actId, query, topK);

const searchSimilarContentForEGazette = (query, gazetteId, topK = 5) =>
  searchContent(
    getEGazetteIndex(),
    "gazetteId",
    gazetteId,
    query,
    topK,
  );

const searchIndexedEGazetteIds = async (query, topK = 100) => {
  if (!String(query || "").trim()) return [];
  const queryEmbedding = await generateEmbedding(query);
  const result = await getEGazetteIndex().query({
    vector: queryEmbedding,
    topK,
    filter: { gazetteId: { $exists: true } },
    includeMetadata: true,
  });
  return [
    ...new Set(
      (result.matches || [])
        .map((match) => match.metadata?.gazetteId)
        .filter(Boolean)
        .map(String),
    ),
  ];
};

const upsertWithRetry = async (index, vectors, retryCount = 0) => {
  const maxRetries = 3;
  try {
    await index.upsert(vectors);
  } catch (error) {
    const retriable =
      error.message?.includes("ECONNRESET") ||
      error.message?.includes("network") ||
      error.message?.includes("fetch failed");

    if (!retriable || retryCount >= maxRetries) throw error;

    const delay = 2_000 * (retryCount + 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
    await upsertWithRetry(index, vectors, retryCount + 1);
  }
};

const storeContentInChunks = async ({
  chunks,
  index,
  idField,
  titleField,
  chunkIdField = "billId",
}) => {
  let totalStored = 0;

  for (
    let start = 0;
    start < chunks.length;
    start += EMBEDDING_BATCH_SIZE
  ) {
    const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE);
    const embeddings = await generateEmbeddings(
      batch.map((chunk) => chunk.embeddingText || chunk.content),
      "RETRIEVAL_DOCUMENT",
    );
    const vectors = batch.map((chunk, index) => ({
      id: chunk.id,
      values: embeddings[index],
      metadata: {
        [idField]: String(
          chunk[chunkIdField] ?? chunk.billId ?? chunk.documentId,
        ),
        [titleField]: chunk.title,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        timestamp: new Date().toISOString(),
        embeddingProvider: EMBEDDING_PROVIDER,
        ...chunk.metadata,
      },
    }));

    await upsertWithRetry(index, vectors);
    totalStored += vectors.length;
  }

  return { chunksStored: totalStored, success: true };
};

const storeBillContentInChunks = (chunks) =>
  storeContentInChunks({
    chunks,
    index: getIndex(),
    idField: "billId",
    titleField: "billTitle",
  });

const storeActContentInChunks = (chunks) =>
  storeContentInChunks({
    chunks,
    index: getActIndex(),
    idField: "actId",
    titleField: "actTitle",
  });

const storeEGazetteContentInChunks = (chunks) =>
  storeContentInChunks({
    chunks,
    index: getEGazetteIndex(),
    idField: "gazetteId",
    titleField: "gazetteTitle",
    chunkIdField: "gazetteId",
  });

const splitIntoChunks = (text, chunkSize = 1_000) => {
  const words = text.split(" ");
  const chunks = [];
  for (let index = 0; index < words.length; index += chunkSize) {
    chunks.push(words.slice(index, index + chunkSize).join(" "));
  }
  return chunks;
};

const storeBillContent = async (
  billId,
  title,
  content,
  metadata = {},
) => {
  const rawChunks = splitIntoChunks(content);
  const chunks = rawChunks.map((chunk, index) => ({
    id: `bill-${billId}-chunk-${index}`,
    billId,
    title,
    content: chunk,
    chunkIndex: index,
    totalChunks: rawChunks.length,
    metadata,
  }));
  return storeBillContentInChunks(chunks);
};

const findSimilarBills = async (billId, billTitle, topK = 5) => {
  const titleEmbedding = await generateEmbedding(billTitle);
  const queryResults = await getIndex().query({
    vector: titleEmbedding,
    topK: (topK + 1) * 10,
    includeMetadata: true,
  });

  const billScores = new Map();
  for (const match of queryResults.matches || []) {
    const matchBillId = match.metadata?.billId;
    if (!matchBillId || matchBillId === String(billId)) continue;

    if (!billScores.has(matchBillId)) {
      billScores.set(matchBillId, {
        billId: matchBillId,
        title: match.metadata.billTitle || match.metadata.title,
        scores: [],
      });
    }
    billScores.get(matchBillId).scores.push(match.score);
  }

  return Array.from(billScores.values())
    .map((bill) => ({
      billId: bill.billId,
      title: bill.title,
      similarityScore:
        bill.scores.reduce((sum, score) => sum + score, 0) /
        bill.scores.length,
      matchCount: bill.scores.length,
    }))
    .sort((left, right) => right.similarityScore - left.similarityScore)
    .slice(0, topK);
};

module.exports = {
  checkActExists,
  checkBillExists,
  checkEGazetteExists,
  createProbeVector,
  findSimilarBills,
  generateActSummary,
  generateBillSummary,
  generateDocumentSummary,
  generateDashboardOverview,
  generateEGazetteSummary,
  generateEmbedding,
  generateEmbeddings,
  generateLocalEmbedding,
  generateResponse,
  getActIndex,
  getEGazetteIndex,
  getIndex,
  searchSimilarContent,
  searchSimilarContentForAct,
  searchSimilarContentForEGazette,
  searchIndexedEGazetteIds,
  storeActContentInChunks,
  storeBillContent,
  storeBillContentInChunks,
  storeEGazetteContentInChunks,
};
