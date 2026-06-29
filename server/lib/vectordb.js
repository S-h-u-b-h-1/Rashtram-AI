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

const generateResponse = async (prompt, context = "") => {
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
inline.
`;

  return runGeneration("generateContentStream", fullPrompt);
};

const generateSummary = async (documentType, content) => {
  const prompt = `
Provide a comprehensive summary of this Indian parliamentary ${documentType}.
Include:
1. Main purpose and objectives
2. Key provisions and sections
3. Potential impact and applicability
4. Important dates or timelines
5. Notable amendments or changes

Document content:
${content}

Write an accurate, well-structured summary. Do not invent information that is
not present in the document.
`;

  const response = await runGeneration("generateContent", prompt);
  return responseText(response);
};

const generateBillSummary = (billContent) =>
  generateSummary("bill", billContent);

const generateActSummary = (actContent) =>
  generateSummary("act", actContent);

const generateEGazetteSummary = async (content) => {
  const prompt = `
Prepare a grounded research brief for this Indian Gazette document.

Use only the supplied text. Clearly state "Not identified in the document"
when evidence is absent. Structure the response with:
1. Executive summary
2. Key notifications or operative changes
3. Affected authorities, ministries, and departments
4. Affected legislation and related Acts
5. Implementation, publication, commencement, or compliance dates
6. Compliance implications and affected persons
7. Important definitions
8. Obligations and procedural requirements
9. Penalties, enforcement, or consequences if mentioned
10. Related rules, notifications, orders, or Acts identifiable from the text

Gazette content:
${content}
`;
  const response = await runGeneration("generateContent", prompt);
  return responseText(response);
};

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
      batch.map((chunk) => chunk.content),
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
