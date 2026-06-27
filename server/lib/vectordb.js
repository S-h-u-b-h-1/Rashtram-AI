const { Pinecone } = require("@pinecone-database/pinecone");

const EMBEDDING_DIMENSION = 768;
const GENERATION_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

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

const createProbeVector = () => {
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);
  vector[0] = 1;
  return vector;
};

const responseText = (response) => {
  if (typeof response?.text === "function") return response.text();
  return response?.text || "";
};

const getIndex = () =>
  getPinecone().index(process.env.PINECONE_INDEX_NAME || "rashtram-bills");

const getActIndex = () =>
  getPinecone().index(
    process.env.PINECONE_ACT_INDEX_NAME || "rashtram-acts",
  );

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

const generateEmbedding = async (text) => {
  const ai = await getGemini();
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIMENSION },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error("Gemini returned no embedding values");
  }

  return normalizeVector(values);
};

const generateResponse = async (prompt, context = "") => {
  const ai = await getGemini();
  const fullPrompt = `
You are Rashtram AI, an assistant for researching Indian parliamentary
documents. Answer using the supplied document context.

Document context:
${context}

User question:
${prompt}

Give a comprehensive, accessible answer. Clearly state when the context does
not contain enough information. Do not invent provisions, dates, or citations.
`;

  return ai.models.generateContentStream({
    model: GENERATION_MODEL,
    contents: fullPrompt,
  });
};

const generateSummary = async (documentType, content) => {
  const ai = await getGemini();
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

  const response = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: prompt,
  });
  return responseText(response);
};

const generateBillSummary = (billContent) =>
  generateSummary("bill", billContent);

const generateActSummary = (actContent) =>
  generateSummary("act", actContent);

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
}) => {
  const batchSize = 50;
  let totalStored = 0;

  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);
    const vectors = [];

    for (const chunk of batch) {
      const embedding = await generateEmbedding(chunk.content);
      vectors.push({
        id: chunk.id,
        values: embedding,
        metadata: {
          [idField]: String(chunk.billId),
          [titleField]: chunk.title,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          timestamp: new Date().toISOString(),
          ...chunk.metadata,
        },
      });
    }

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
  createProbeVector,
  findSimilarBills,
  generateActSummary,
  generateBillSummary,
  generateEmbedding,
  generateResponse,
  getActIndex,
  getIndex,
  searchSimilarContent,
  searchSimilarContentForAct,
  storeActContentInChunks,
  storeBillContent,
  storeBillContentInChunks,
};
