const { Pinecone } = require("@pinecone-database/pinecone");
const {
  classifyProviderError,
  sanitizeProviderError,
} = require("./providerErrorSanitizer");
const { createCircuitBreaker } = require("./circuitBreaker");
const { checkVectorNamespaces } = require("./vectorNamespaceHealth");
const { getOrCreateQueryEmbedding } = require("../retrieval/researchCache");
const {
  createRateLimitedQueue,
  isRateLimitError,
  retryAfterSecondsFrom,
} = require("./rateLimitedQueue");

const EMBEDDING_DIMENSION = 768;
const EMBEDDING_BATCH_SIZE = 50;
const EMBEDDING_BATCH_TOKEN_BUDGET = Math.min(
  250_000,
  Math.max(
    10_000,
    Number(process.env.EMBEDDING_BATCH_TOKEN_BUDGET || 240_000),
  ),
);
const normaliseProvider = (value) =>
  String(value || "").trim().toLowerCase().replace(/^google-/, "");
const isGeminiBaseUrl = (value) =>
  String(value || "").includes("generativelanguage.googleapis.com");
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const AI_PROVIDER = normaliseProvider(
  process.env.AI_PROVIDER || (GEMINI_API_KEY ? "gemini" : "openai"),
);
const requestedEmbeddingProvider = normaliseProvider(
  process.env.EMBEDDING_PROVIDER || AI_PROVIDER,
);
const EMBEDDING_PROVIDER =
  AI_PROVIDER === "gemini" && requestedEmbeddingProvider !== "local"
    ? "gemini"
    : requestedEmbeddingProvider;
const normalizeGenerationModel = (value, fallback, provider = AI_PROVIDER) => {
  const model = String(value || "").trim();
  if (provider === "openai" && /^gemini/i.test(model)) return fallback;
  if (provider === "gemini" && /^gpt-/i.test(model)) {
    return process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  }
  if (provider === "gemini" && /^gemini-1\.5-/i.test(model)) {
    return "gemini-2.5-flash-lite";
  }
  return model || fallback;
};
const normalizeEmbeddingModel = (value, provider = EMBEDDING_PROVIDER) => {
  const model = String(value || "").trim();
  if (provider === "openai" && /^text-embedding-00[0-9]/i.test(model)) {
    return "text-embedding-3-large";
  }
  if (provider === "gemini" && /^text-embedding-3/i.test(model)) {
    return "gemini-embedding-001";
  }
  if (provider === "gemini" && model === "text-embedding-004") {
    return "gemini-embedding-001";
  }
  return model || (provider === "gemini" ? "gemini-embedding-001" : "text-embedding-3-large");
};
const GENERATION_MODEL =
  AI_PROVIDER === "gemini"
    ? normalizeGenerationModel(
        process.env.GEMINI_MODEL || process.env.GEMINI_CHAT_MODEL,
        "gemini-2.5-flash-lite",
        "gemini",
      )
    : normalizeGenerationModel(
        process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL,
        "gpt-4.1-mini",
        "openai",
      );
const FALLBACK_GENERATION_MODEL =
  AI_PROVIDER === "gemini"
    ? normalizeGenerationModel(
        process.env.GEMINI_FALLBACK_MODEL,
        "gemini-flash-latest",
        "gemini",
      )
    : normalizeGenerationModel(process.env.OPENAI_FALLBACK_MODEL, "gpt-4o-mini", "openai");
const DEFAULT_SECONDARY_GENERATION_MODEL =
  AI_PROVIDER === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini";
const FAST_GENERATION_MODEL =
  AI_PROVIDER === "gemini"
    ? normalizeGenerationModel(
        process.env.GEMINI_FAST_MODEL,
        "gemini-2.5-flash-lite",
        "gemini",
      )
    : normalizeGenerationModel(process.env.OPENAI_FAST_MODEL, "gpt-4.1-mini", "openai");
const EMBEDDING_MODEL =
  EMBEDDING_PROVIDER === "local"
    ? "local-hash-v1"
    : EMBEDDING_PROVIDER === "gemini"
    ? normalizeEmbeddingModel(process.env.GEMINI_EMBEDDING_MODEL, "gemini")
    : normalizeEmbeddingModel(process.env.OPENAI_EMBEDDING_MODEL, "openai");
const EMBEDDING_FALLBACK_PROVIDER = normaliseProvider(
  process.env.EMBEDDING_FALLBACK_PROVIDER ||
    (["1", "true", "yes", "on"].includes(
      String(process.env.EMBEDDING_ALLOW_LOCAL_FALLBACK || "")
        .trim()
        .toLowerCase(),
    )
      ? "local"
      : "none"),
);
const VECTOR_NAMESPACE =
  process.env.PINECONE_NAMESPACE ||
  (EMBEDDING_PROVIDER === "local"
    ? "local-hash-v1"
    : `${EMBEDDING_MODEL}-${EMBEDDING_DIMENSION}-v1`);

// Independently-scoped breakers: an embedding outage must never block chat
// generation (or vice versa) since chunk creation must not depend on
// generation succeeding. Both fail fast into each function's existing
// fallback path (local embeddings / extractive chat fallback) — no new
// fallback behavior, just fewer wasted calls into a provider that's down.
const embeddingBreaker = createCircuitBreaker(`embedding:${EMBEDDING_PROVIDER}`, {
  failureThreshold: 5,
  cooldownMs: 30_000,
});
const generationBreaker = createCircuitBreaker(`generation:${AI_PROVIDER}`, {
  failureThreshold: 5,
  cooldownMs: 30_000,
});

let pineconeClient;
let openAIClientPromise;
let aiHealthCache = {
  checkedAt: 0,
  ttlMs: Number(process.env.AI_HEALTH_CACHE_MS || 300_000),
  result: null,
};

const getPinecone = () => {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is required");
  }

  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }

  return pineconeClient;
};

const getOpenAI = async () => {
  const apiKey = OPENAI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or GEMINI_API_KEY is required");
  }

  if (!openAIClientPromise) {
    let configuredBaseUrl = String(process.env.OPENAI_BASE_URL || "").trim();
    if (GEMINI_API_KEY && !configuredBaseUrl) {
      configuredBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
    }
    const useConfiguredBaseUrl = Boolean(configuredBaseUrl) && !(
      isGeminiBaseUrl(configuredBaseUrl) &&
      String(OPENAI_API_KEY || "").startsWith("sk-")
    );
    openAIClientPromise = import("openai").then(
      ({ default: OpenAI }) =>
        new OpenAI({
          apiKey: apiKey,
          baseURL: useConfiguredBaseUrl
            ? configuredBaseUrl || undefined
            : undefined,
        }),
    );
  }

  return openAIClientPromise;
};

const geminiModelPath = (model) => {
  const value = String(model || "").trim();
  return value.startsWith("models/") ? value : `models/${value}`;
};

const geminiEndpoint = (model, action, { stream = false } = {}) => {
  const baseUrl = String(
    process.env.GEMINI_BASE_URL ||
      "https://generativelanguage.googleapis.com/v1beta",
  ).replace(/\/+$/, "");
  const params = new URLSearchParams({ key: GEMINI_API_KEY });
  if (stream) params.set("alt", "sse");
  return `${baseUrl}/${geminiModelPath(model)}:${action}?${params.toString()}`;
};

const geminiFetch = async (model, action, body, options = {}) => {
  if (!GEMINI_API_KEY) {
    const error = new Error("GEMINI_API_KEY is required");
    error.status = 503;
    throw error;
  }
  const timeoutMs = Number(options.timeoutMs || process.env.AI_REQUEST_TIMEOUT_MS || 60_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      geminiEndpoint(model, action, { stream: options.stream }),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(
        payload.error?.message ||
          `Gemini ${action} request failed with status ${response.status}`,
      );
      error.status = response.status;
      error.provider = "gemini";
      error.headers = Object.fromEntries(response.headers.entries());
      error.payload = payload;
      throw error;
    }
    return options.stream ? response : response.json();
  } finally {
    clearTimeout(timeout);
  }
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

const estimateEmbeddingTokens = (text) => {
  const value = String(text || "");
  let asciiCharacters = 0;
  let nonAsciiCharacters = 0;
  for (const character of value) {
    if (character.codePointAt(0) <= 0x7f) asciiCharacters += 1;
    else nonAsciiCharacters += 1;
  }
  return Math.max(
    1,
    Math.ceil(asciiCharacters / 4) + nonAsciiCharacters,
  );
};

const buildEmbeddingBatches = (
  texts,
  {
    maxInputs = EMBEDDING_BATCH_SIZE,
    tokenBudget = EMBEDDING_BATCH_TOKEN_BUDGET,
  } = {},
) => {
  const batches = [];
  let batch = [];
  let estimatedTokens = 0;

  for (const text of texts) {
    const textTokens = estimateEmbeddingTokens(text);
    if (
      batch.length > 0 &&
      (batch.length >= maxInputs ||
        estimatedTokens + textTokens > tokenBudget)
    ) {
      batches.push(batch);
      batch = [];
      estimatedTokens = 0;
    }
    batch.push(text);
    estimatedTokens += textTokens;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
};

const createProbeVector = () => {
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);
  vector[0] = 1;
  return vector;
};

const responseText = (response) => {
  if (typeof response?.output_text === "string") return response.output_text;
  if (typeof response?.text === "function") return response.text();
  if (typeof response?.choices?.[0]?.message?.content === "string") {
    return response.choices[0].message.content;
  }
  const geminiParts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(geminiParts)) {
    return geminiParts.map((part) => part.text || "").join("");
  }
  return response?.text || "";
};

const isTransientOpenAIError = (error) => {
  const status = Number(error?.status || error?.code);
  const message = String(error?.message || "");
  return (
    [408, 409, 429, 500, 502, 503, 504].includes(status) ||
    /overloaded|unavailable|rate limit|temporar|timeout/i.test(message)
  );
};

const isUnavailableModelError = (error) => {
  const status = Number(error?.status || error?.code);
  const message = String(error?.message || "");
  return (
    [400, 403, 404].includes(status) &&
    /model|access|not found|does not exist|unsupported/i.test(message)
  );
};

const withOpenAIRetry = async (operation, label, attempts = 3, options = {}) => {
  let lastError;
  const maxRetryAfterMs = Math.max(
    0,
    Number(options.maxRetryAfterMs ?? process.env.AI_RATE_LIMIT_MAX_RETRY_WAIT_MS ?? 30_000),
  );

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientOpenAIError(error) || attempt === attempts) throw error;

      const retryAfterSeconds = isRateLimitError(error)
        ? retryAfterSecondsFrom(error)
        : 0;
      if (options.rateLimiter && retryAfterSeconds > 0) {
        options.rateLimiter.noteRetryAfter(retryAfterSeconds);
      }
      const retryAfterMs = retryAfterSeconds > 0
        ? Math.min(maxRetryAfterMs, Math.ceil(retryAfterSeconds * 1000))
        : 0;
      const delay = retryAfterMs || 1_000 * 2 ** (attempt - 1);
      console.warn(
        `${label} temporarily unavailable; retrying in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

const generationModels = () =>
  [
    ...new Set([
      GENERATION_MODEL,
      FALLBACK_GENERATION_MODEL,
      DEFAULT_SECONDARY_GENERATION_MODEL,
    ]),
  ].filter(Boolean);

const taskGenerationModels = (task = "default") => {
  if (task === "comparison") {
    return [
      ...new Set([
        process.env.GEMINI_COMPARISON_MODEL ||
          process.env.OPENAI_COMPARISON_MODEL ||
          DEFAULT_SECONDARY_GENERATION_MODEL,
        GENERATION_MODEL,
        FALLBACK_GENERATION_MODEL,
        FAST_GENERATION_MODEL,
      ]),
    ].filter(Boolean);
  }
  if (task === "chat") {
    return [
      ...new Set([
        FAST_GENERATION_MODEL,
        GENERATION_MODEL,
        FALLBACK_GENERATION_MODEL,
        DEFAULT_SECONDARY_GENERATION_MODEL,
      ]),
    ].filter(Boolean);
  }
  return generationModels();
};

const providerCredentialsConfigured = () =>
  AI_PROVIDER === "gemini" ? Boolean(GEMINI_API_KEY) : Boolean(OPENAI_API_KEY);

const embeddingCredentialsConfigured = () => {
  if (EMBEDDING_PROVIDER === "local") return true;
  return EMBEDDING_PROVIDER === "gemini"
    ? Boolean(GEMINI_API_KEY)
    : Boolean(OPENAI_API_KEY);
};

const providerConfig = () => ({
  aiProvider: AI_PROVIDER,
  embeddingProvider: EMBEDDING_PROVIDER,
  openaiBaseUrlConfigured: Boolean(String(process.env.OPENAI_BASE_URL || "").trim()),
  usingGeminiCompatibleEndpoint: isGeminiBaseUrl(process.env.OPENAI_BASE_URL),
  chatModel: GENERATION_MODEL,
  fallbackChatModel: FALLBACK_GENERATION_MODEL,
  embeddingModel: EMBEDDING_MODEL,
  embeddingFallbackProvider: EMBEDDING_FALLBACK_PROVIDER,
  embeddingDimension: EMBEDDING_DIMENSION,
  vectorNamespace: VECTOR_NAMESPACE,
  chatModelConfigured: Boolean(GENERATION_MODEL),
  embeddingModelConfigured: Boolean(EMBEDDING_MODEL),
  credentialsConfigured: providerCredentialsConfigured(),
  embeddingCredentialsConfigured: embeddingCredentialsConfigured(),
});

const validateAIProvider = async ({ force = false } = {}) => {
  const now = Date.now();
  if (
    !force &&
    aiHealthCache.result &&
    now - aiHealthCache.checkedAt < aiHealthCache.ttlMs
  ) {
    return aiHealthCache.result;
  }

  const config = providerConfig();
  const health = {
    aiProvider: config.aiProvider,
    embeddingProvider: config.embeddingProvider,
    chatModel: config.chatModel,
    embeddingModel: config.embeddingModel,
    chatModelConfigured: config.chatModelConfigured,
    embeddingModelConfigured: config.embeddingModelConfigured,
    generationAvailable: false,
    embeddingAvailable: false,
    streamingAvailable: false,
    latencyMs: {},
    checkedAt: new Date().toISOString(),
    errors: {},
    errorKinds: {},
  };

  if (!config.credentialsConfigured) {
    health.errors.generation = `${AI_PROVIDER.toUpperCase()} credentials are not configured.`;
  }
  if (!config.embeddingCredentialsConfigured) {
    health.errors.embedding = `${EMBEDDING_PROVIDER.toUpperCase()} embedding credentials are not configured.`;
  }
  if (!config.credentialsConfigured || !config.embeddingCredentialsConfigured) {
    aiHealthCache = { ...aiHealthCache, checkedAt: now, result: health };
    return health;
  }

  try {
    const started = Date.now();
    const response = await runGeneration(
      "generateContent",
      "Reply with exactly: OK",
      {
        attempts: 1,
        maxQueueWaitMs: Number(process.env.AI_HEALTH_MAX_QUEUE_WAIT_MS || 5_000),
        timeoutMs: Number(process.env.AI_HEALTH_REQUEST_TIMEOUT_MS || 8_000),
        useCircuitBreaker: false,
        useRateLimiter: false,
      },
    );
    health.generationAvailable = Boolean(responseText(response).trim());
    health.latencyMs.generation = Date.now() - started;
  } catch (error) {
    health.errors.generation = sanitizeProviderError(error);
    health.errorKinds.generation = classifyProviderError(error);
  }

  try {
    const started = Date.now();
    const vector = (
      await generateEmbeddings(
        ["Rashtram AI provider health check"],
        "RETRIEVAL_QUERY",
        { allowLocalFallback: false },
      )
    )[0] || [];
    health.embeddingAvailable = vector.length === EMBEDDING_DIMENSION;
    health.latencyMs.embedding = Date.now() - started;
    if (!health.embeddingAvailable) {
      health.errors.embedding = `Embedding dimension mismatch: ${vector.length || 0}`;
    }
  } catch (error) {
    health.errors.embedding = sanitizeProviderError(error);
    health.errorKinds.embedding = classifyProviderError(error);
  }

  try {
    const started = Date.now();
    const stream = await runGeneration(
      "generateContentStream",
      "Reply with exactly: OK",
      {
        attempts: 1,
        maxQueueWaitMs: Number(process.env.AI_HEALTH_MAX_QUEUE_WAIT_MS || 5_000),
        timeoutMs: Number(process.env.AI_HEALTH_REQUEST_TIMEOUT_MS || 8_000),
        useCircuitBreaker: false,
        useRateLimiter: false,
      },
    );
    for await (const chunk of stream) {
      if (chunk.text) {
        health.streamingAvailable = true;
        break;
      }
    }
    health.latencyMs.streaming = Date.now() - started;
    if (!health.streamingAvailable) {
      health.errors.streaming = "Streaming response returned no text.";
    }
  } catch (error) {
    health.errors.streaming = sanitizeProviderError(error);
    health.errorKinds.streaming = classifyProviderError(error);
  }

  // Namespace occupancy. Reported even when generation and embedding are
  // healthy, because an orphaned namespace produces no errors at all —
  // just silently empty vector search. This is what makes switching
  // embedding provider a visible, verifiable operation instead of a
  // change that quietly strands the corpus.
  try {
    health.vectorNamespace = await checkVectorNamespaces(
      [
        { name: "bills", index: getIndex() },
        { name: "acts", index: getActIndex() },
      ],
      VECTOR_NAMESPACE,
    );
    if (!health.vectorNamespace.healthy) {
      const detail = Object.values(health.vectorNamespace.indexes)
        .map((entry) => entry.message)
        .filter(Boolean)[0];
      if (detail) health.errors.vectorNamespace = detail;
    }
  } catch (error) {
    health.errors.vectorNamespace = sanitizeProviderError(error);
    health.errorKinds.vectorNamespace = classifyProviderError(error);
  }

  aiHealthCache = { ...aiHealthCache, checkedAt: now, result: health };
  return health;
};

const responseEventStream = async function* (events) {
  for await (const event of events) {
    if (event.type === "response.output_text.delta" && event.delta) {
      yield { text: event.delta };
    } else if (event.type === "error") {
      throw new Error(event.message || "OpenAI streaming response failed.");
    } else if (event.type === "response.failed") {
      throw new Error(
        event.response?.error?.message || "OpenAI response failed.",
      );
    }
  }
};

const chatCompletionEventStream = async function* (events) {
  for await (const event of events) {
    const content = event.choices?.[0]?.delta?.content || "";
    if (content) yield { text: content };
  }
};

const geminiEventStream = async function* (response) {
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error("Gemini streaming response body is unavailable.");
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      const event = JSON.parse(raw);
      const parts = event.candidates?.[0]?.content?.parts || [];
      const text = parts.map((part) => part.text || "").join("");
      if (text) yield { text };
    }
  }

  const tail = buffer.trim();
  if (tail.startsWith("data:")) {
    const raw = tail.slice(5).trim();
    if (raw && raw !== "[DONE]") {
      const event = JSON.parse(raw);
      const parts = event.candidates?.[0]?.content?.parts || [];
      const text = parts.map((part) => part.text || "").join("");
      if (text) yield { text };
    }
  }
};

const isResponsesApiUnavailable = (error) => {
  const status = Number(error?.status || error?.code);
  const message = String(error?.message || "");
  return (
    [404, 405].includes(status) ||
    /responses|not found|no body|unsupported endpoint/i.test(message)
  );
};

// Gemini's free tier caps generate_content at ~20 requests per short
// window. The breaker only reacts once calls already failed; pacing stops
// the burst that trips the limit in the first place. Configurable so a
// paid tier can raise it without a code change.
const generationQueue = createRateLimitedQueue({
  maxRequests: Number(
    process.env.GEMINI_GENERATION_MAX_REQUESTS_PER_WINDOW ||
      process.env.AI_GENERATION_RPM ||
      18,
  ),
  windowMs: Number(process.env.GEMINI_GENERATION_WINDOW_MS || 60_000),
  safetyFactor: Number(process.env.GEMINI_GENERATION_SAFETY_FACTOR || 0.85),
});

const scheduleGeneration = (method, contents, options = {}) =>
  generationQueue.schedule(
    async () => {
      try {
        return await runGenerationInternal(method, contents, options);
      } catch (error) {
        // Feed the provider's own stated wait back into the pacer so the
        // next caller doesn't immediately retry into the same limit.
        if (isRateLimitError(error)) {
          generationQueue.noteRetryAfter(retryAfterSecondsFrom(error) || 20);
        }
        throw error;
      }
    },
    {
      maxWaitMs: Number(
        options.maxQueueWaitMs ??
          process.env.AI_GENERATION_MAX_QUEUE_WAIT_MS ??
          30_000,
      ),
    },
  );

const runGeneration = (method, contents, options = {}) => {
  const execute = () =>
    options.useRateLimiter === false
      ? runGenerationInternal(method, contents, options)
      : scheduleGeneration(method, contents, options);
  return options.useCircuitBreaker === false
    ? execute()
    : generationBreaker.exec(execute);
};

const runGenerationInternal = async (method, contents, options = {}) => {
  const candidateModels = Array.isArray(options.models) && options.models.length
    ? options.models
    : generationModels();
  const models = [...new Set(candidateModels.map((model) =>
    normalizeGenerationModel(model, model),
  ))].filter(Boolean).slice(
    0,
    Math.max(1, Number(options.maxModels || candidateModels.length)),
  );
  const attempts = Math.max(1, Number(options.attempts || 3));
  if (AI_PROVIDER === "gemini") {
    const stream = method === "generateContentStream";
    let lastError;
    for (const model of models) {
      try {
        const response = await withOpenAIRetry(
          () =>
            geminiFetch(
              model,
              stream ? "streamGenerateContent" : "generateContent",
              {
                contents: [
                  {
                    role: "user",
                    parts: [{ text: String(contents || "") }],
                  },
                ],
                ...(options.generationConfig
                  ? { generationConfig: options.generationConfig }
                  : {}),
              },
              { stream, timeoutMs: options.timeoutMs },
            ),
          `Gemini model ${model}`,
          attempts,
          {
            rateLimiter: generationQueue,
            maxRetryAfterMs: options.maxRetryAfterMs,
          },
        );
        return stream ? geminiEventStream(response) : response;
      } catch (error) {
        lastError = error;
        if (
          !isTransientOpenAIError(error) &&
          !isUnavailableModelError(error)
        ) {
          throw error;
        }
        console.warn(`Gemini model ${model} unavailable; trying fallback`);
      }
    }
    throw lastError;
  }

  const openai = await getOpenAI();
  const stream = method === "generateContentStream";
  let lastError;

  for (const model of models) {
    try {
      const response = await withOpenAIRetry(
        () =>
          openai.responses.create({
            model,
            input: contents,
            stream,
            ...(options.generationConfig?.maxOutputTokens
              ? { max_output_tokens: options.generationConfig.maxOutputTokens }
              : {}),
          }),
        `OpenAI model ${model}`,
        attempts,
      );
      return stream ? responseEventStream(response) : response;
    } catch (error) {
      if (isResponsesApiUnavailable(error)) {
        try {
          const response = await withOpenAIRetry(
            () =>
              openai.chat.completions.create({
                model,
                messages: [{ role: "user", content: contents }],
                stream,
                ...(options.generationConfig?.maxOutputTokens
                  ? { max_tokens: options.generationConfig.maxOutputTokens }
                  : {}),
              }),
            `OpenAI-compatible chat model ${model}`,
            attempts,
          );
          return stream ? chatCompletionEventStream(response) : response;
        } catch (chatError) {
          lastError = chatError;
          if (
            !isTransientOpenAIError(chatError) &&
            !isUnavailableModelError(chatError)
          ) {
            throw chatError;
          }
          console.warn(
            `OpenAI-compatible chat model ${model} unavailable; trying fallback`,
          );
          continue;
        }
      }
      lastError = error;
      if (
        !isTransientOpenAIError(error) &&
        !isUnavailableModelError(error)
      ) {
        throw error;
      }
      console.warn(`OpenAI model ${model} unavailable; trying fallback`);
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

const getPolicyIndex = () =>
  getPinecone()
    .index(
      process.env.PINECONE_POLICY_INDEX_NAME ||
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

const checkPolicyExists = async (policyId) => {
  const result = await checkDocumentExists(
    getPolicyIndex(),
    "policyId",
    policyId,
  );
  return {
    ...result,
    policyTitle: result.title,
  };
};

const generateEmbeddings = async (
  texts,
  taskType = "RETRIEVAL_DOCUMENT",
  { allowLocalFallback = true, provider = EMBEDDING_PROVIDER } = {},
) => {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const selectedProvider = normaliseProvider(provider || EMBEDDING_PROVIDER);
  const selectedModel = selectedProvider === EMBEDDING_PROVIDER
    ? EMBEDDING_MODEL
    : normalizeEmbeddingModel(
        selectedProvider === "gemini"
          ? process.env.GEMINI_EMBEDDING_MODEL
          : process.env.OPENAI_EMBEDDING_MODEL,
        selectedProvider,
      );
  if (selectedProvider === "local") {
    return texts.map(generateLocalEmbedding);
  }
  if (!["openai", "gemini"].includes(selectedProvider)) {
    throw new Error(
      `Unsupported EMBEDDING_PROVIDER: ${selectedProvider}`,
    );
  }

  const vectors = [];
  try {
    if (selectedProvider === "gemini") {
      for (const batch of buildEmbeddingBatches(texts, { maxInputs: 100 })) {
        const response = await embeddingBreaker.exec(() =>
          withOpenAIRetry(
            () =>
              geminiFetch(selectedModel, "batchEmbedContents", {
                requests: batch.map((text) => ({
                  model: geminiModelPath(selectedModel),
                  content: { parts: [{ text: String(text || "") }] },
                  taskType,
                  outputDimensionality: EMBEDDING_DIMENSION,
                })),
              }),
            `Gemini embedding model ${selectedModel}`,
          ),
        );

        const embeddings = response.embeddings || [];
        if (embeddings.length !== batch.length) {
          throw new Error(
            `Gemini returned ${embeddings.length} embeddings for ${batch.length} inputs`,
          );
        }
        embeddings.forEach((embedding, index) => {
          if (!embedding.values?.length) {
            throw new Error(`Gemini returned no values for embedding ${index}`);
          }
          vectors.push(normalizeVector(embedding.values));
        });
      }
      return vectors;
    }

    const openai = await getOpenAI();
    for (const batch of buildEmbeddingBatches(texts)) {
      const response = await embeddingBreaker.exec(() =>
        withOpenAIRetry(
          () =>
            openai.embeddings.create({
              model: selectedModel,
              input: batch,
              encoding_format: "float",
              dimensions: EMBEDDING_DIMENSION,
            }),
          `OpenAI embedding model ${selectedModel}`,
        ),
      );

      const embeddings = [...(response.data || [])].sort(
        (left, right) => left.index - right.index,
      );
      if (embeddings.length !== batch.length) {
        throw new Error(
          `OpenAI returned ${embeddings.length} embeddings for ${batch.length} inputs`,
        );
      }
      embeddings.forEach((embedding, index) => {
        if (!embedding.embedding?.length) {
          throw new Error(`OpenAI returned no values for embedding ${index}`);
        }
        vectors.push(normalizeVector(embedding.embedding));
      });
    }
  } catch (error) {
    if (
      !allowLocalFallback ||
      !["local", "local-hash-v1"].includes(EMBEDDING_FALLBACK_PROVIDER)
    ) {
      throw error;
    }
    console.warn(
      `Remote ${selectedProvider} embedding unavailable; using explicitly configured deterministic local embeddings: ${error.message}`,
    );
    return texts.map(generateLocalEmbedding);
  }
  return vectors;
};

const generateEmbeddingWithMetrics = async (text) => {
  const startedAt = Date.now();
  const result = await getOrCreateQueryEmbedding({
    query: text,
    provider: EMBEDDING_PROVIDER,
    model: EMBEDDING_MODEL,
    version: VECTOR_NAMESPACE,
    dimension: EMBEDDING_DIMENSION,
  }, async () => (await generateEmbeddings([text], "RETRIEVAL_QUERY"))[0]);
  return {
    vector: result.embedding,
    cacheStatus: result.cacheStatus,
    elapsedMs: Date.now() - startedAt,
  };
};

const generateEmbedding = async (text) =>
  (await generateEmbeddingWithMetrics(text)).vector;

const normalizeResponseLanguage = (value, prompt = "") => {
  const requested = String(value || "Auto").trim().toLowerCase();
  if (requested.startsWith("hi") || requested === "hindi") return "Hindi";
  if (requested.startsWith("en") || requested === "english") return "English";
  return /[\u0900-\u097f]/u.test(String(prompt || ""))
    ? "Hindi"
    : "English";
};

const generateResponse = async (
  prompt,
  context = "",
  { responseLanguage = "Auto" } = {},
) => {
  const language = normalizeResponseLanguage(responseLanguage, prompt);
  const fullPrompt = `
You are Rashtram AI, an assistant for researching Indian legislative, legal,
and Gazette documents. Answer using the supplied document context.

Document context:
${context}

User question:
${prompt}

Give a concise but useful research answer. Use stated facts first, then clearly
label any direct implication as "Implication:" when the user asks for risks,
objectives, affected institutions, or implementation issues that are not named
as headings in the source. Do not invent provisions, dates, figures, named
institutions, or citations. If the context gives only partial evidence, answer
with the partial evidence and say what is not identified.

When the user asks about the impact on a group that is not explicitly named,
do not stop after saying that direct evidence is absent. Provide a structured
answer covering: (1) confirmed direct effects, (2) plausible indirect impact
channels derived from the cited provisions, (3) practical implications for the
group, and (4) evidence gaps or facts that should be verified. Label every
inference "Analytical implication" and never present it as a stated provision.
When the user asks for a brief or report, write a complete standalone output
with a title, executive summary, evidence, implications, limitations, and next
research questions. Artifact downloads are handled by the Rashtram AI interface;
do not claim that Rashtram AI is unable to create or download files.

When the context contains labels such as [Source 1: Document | Page | Section |
Chunk] or [Document brief: Title], cite those exact labels inline for every
substantive claim. Prefer 3-6 short bullets for analytical questions. Respond
in ${language}. Preserve quoted source text in its original language and explain
it in ${language} when needed.

Grounding rules are mandatory:
1. Treat only the labelled retrieved source passages as factual evidence.
2. Document briefs, earlier assistant messages, graph inferences, and general
   model knowledge are not proof of a legal or policy fact.
3. Attach an exact retrieved citation label to every factual statement.
4. Clearly prefix interpretation with "Analytical implication:" and state its
   uncertainty; do not rewrite an inference as a source fact.
5. If the passages do not support the answer, say that the available sources
   are insufficient. Never invent a section, date, amendment, legal effect,
   institution, page, clause, or source relationship.
6. A page marked estimated must remain described as estimated.
`;

  return runGeneration("generateContentStream", fullPrompt, {
    models: taskGenerationModels("chat"),
    maxModels: Number(process.env.CHAT_AI_MAX_MODELS || 3),
    timeoutMs: Number(process.env.CHAT_AI_TIMEOUT_MS || 18_000),
    maxQueueWaitMs: Number(process.env.CHAT_AI_MAX_QUEUE_WAIT_MS || 3_000),
    maxRetryAfterMs: Number(process.env.CHAT_AI_MAX_RETRY_AFTER_MS || 0),
    attempts: Number(process.env.CHAT_AI_ATTEMPTS || 1),
    generationConfig: {
      temperature: Number(process.env.CHAT_AI_TEMPERATURE || 0.2),
      maxOutputTokens: Number(process.env.CHAT_AI_MAX_OUTPUT_TOKENS || 900),
    },
  });
};

const generatePolicyDraft = async (
  prompt,
  context = "",
  { responseLanguage = "English" } = {},
) => {
  const language = normalizeResponseLanguage(responseLanguage, prompt);
  const fullPrompt = `
You are Rashtram AI's policy drafting copilot for researchers and think tanks.
Draft a practical, evidence-led public policy proposal using only the supplied
brief and source material. This is a research draft, not legal advice and not
an official government position. Clearly separate evidence from proposed
recommendations. Never invent statistics, laws, budgets, institutions, dates,
or commitments. If evidence is missing, write "To be validated" and add it to
the open questions section.

Return a polished Markdown policy draft with exactly these sections:
# Policy Draft
## Problem and Evidence
## Policy Objectives
## Target Groups and Equity Considerations
## Policy Options
## Recommended Approach
## Implementation Plan
## Institutions and Responsibilities
## Funding and Delivery Model
## Monitoring, Evaluation, and Learning
## Risks and Mitigations
## Consultation Questions
## Evidence Notes

Use concise tables or bullets where useful. Cite supplied labels such as
[Catalogue document: ...] and [User source: ...] inline for every substantive
evidence claim. Do not present independent research as government policy.
Write in ${language} while retaining important original-language terms.

Researcher brief:
${prompt}

Source material:
${context}
`;

  return runGeneration("generateContentStream", fullPrompt, {
    models: taskGenerationModels("chat"),
    maxModels: Number(process.env.POLICY_DRAFT_AI_MAX_MODELS || 2),
    timeoutMs: Number(process.env.POLICY_DRAFT_AI_TIMEOUT_MS || 24_000),
    maxQueueWaitMs: Number(process.env.POLICY_DRAFT_AI_MAX_QUEUE_WAIT_MS || 3_000),
    maxRetryAfterMs: Number(process.env.POLICY_DRAFT_AI_MAX_RETRY_AFTER_MS || 0),
    attempts: Number(process.env.POLICY_DRAFT_AI_ATTEMPTS || 1),
    generationConfig: {
      temperature: Number(process.env.POLICY_DRAFT_AI_TEMPERATURE || 0.25),
      maxOutputTokens: Number(process.env.POLICY_DRAFT_AI_MAX_OUTPUT_TOKENS || 2_400),
    },
  });
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

const extractiveSummary = (documentType, content) => {
  const value = String(content || "").replace(/\s+/g, " ").trim();
  const sentences = value
    .split(/(?<=[.!?।॥])\s+/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const opening = sentences.slice(0, 4).join(" ");
  const terms = [
    ...new Set(
      (value.match(/\b[A-Z][A-Za-z&.\-]*(?:\s+[A-Z][A-Za-z&.\-]*){0,4}\b/g) || [])
        .map((item) => item.trim())
        .filter((item) => item.length > 3),
    ),
  ].slice(0, 8);
  return [
    "## Executive Summary",
    opening || `This ${documentType || "document"} was processed from source text.`,
    "",
    "## Key Provisions",
    sentences.slice(4, 10).map((sentence) => `- ${sentence}`).join("\n") ||
      "- Not identified in the document.",
    "",
    "## Affected Authorities",
    terms.map((term) => `- ${term}`).join("\n") ||
      "- Not identified in the document.",
    "",
    "## Important Dates",
    "- Not identified in the document.",
    "",
    "## Implementation",
    "- Review the original source snippets for implementation details.",
    "",
    "## Legal Impact",
    "- Not identified in the document.",
    "",
    "## Compliance Notes",
    "- Not identified in the document.",
    "",
    "## Related Documents",
    "- Not identified in the document.",
    "",
    "## Suggested Questions",
    "- What are the main policy objectives?",
    "- Which institutions are affected?",
    "- What implementation risks are stated?",
  ].join("\n");
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
and defined terms. Do not invent legal provisions or relationships. Write in
English. When translating Hindi terms, retain the important original Hindi
term in parentheses on first use.

Use exactly these Markdown sections:
## Executive Summary
## Key Provisions
## Affected Authorities
## Important Dates
## Implementation
## Legal Impact
## Compliance Notes
## Related Documents
## Suggested Questions

Document content:
${content}
`;

  try {
    const response = await runGeneration("generateContent", prompt, {
      models: taskGenerationModels("chat"),
      maxModels: Number(process.env.SUMMARY_AI_MAX_MODELS || 2),
      timeoutMs: Number(process.env.SUMMARY_AI_TIMEOUT_MS || 12_000),
      maxQueueWaitMs: Number(process.env.SUMMARY_AI_MAX_QUEUE_WAIT_MS || 3_000),
      maxRetryAfterMs: Number(process.env.SUMMARY_AI_MAX_RETRY_AFTER_MS || 0),
      attempts: Number(process.env.SUMMARY_AI_ATTEMPTS || 1),
      generationConfig: {
        temperature: Number(process.env.SUMMARY_AI_TEMPERATURE || 0.1),
        maxOutputTokens: Number(process.env.SUMMARY_AI_MAX_OUTPUT_TOKENS || 1_200),
      },
    });
    return responseText(response);
  } catch (error) {
    console.warn(
      `Summary generation unavailable; using extractive fallback: ${error.message}`,
    );
    return extractiveSummary(normalizedType, content);
  }
};

const parseSuggestedQuestions = (value) => {
  const normalized = String(value || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(normalized);
    return (Array.isArray(parsed) ? parsed : parsed.questions || [])
      .map((question) => String(question || "").trim())
      .filter(Boolean)
      .slice(0, 4);
  } catch {
    return [];
  }
};

const generateSuggestedQuestions = async (documentType, summary) => {
  const response = await runGeneration(
    "generateContent",
    [
      "Create four concise research questions that are directly answerable from this document brief.",
      `Document type: ${documentType}.`,
      "Do not ask about institutions, risks, dates, penalties, or compliance unless the brief identifies evidence for them.",
      "Prefer specific questions using the document's stated subjects, figures, authorities, objectives, or affected groups.",
      "Return only a JSON array of strings. Do not add Markdown.",
      summary,
    ].join("\n\n"),
    {
      models: taskGenerationModels("chat"),
      maxModels: Number(process.env.SUGGESTED_QUESTIONS_AI_MAX_MODELS || 2),
      timeoutMs: Number(process.env.SUGGESTED_QUESTIONS_AI_TIMEOUT_MS || 8_000),
      maxQueueWaitMs: Number(
        process.env.SUGGESTED_QUESTIONS_AI_MAX_QUEUE_WAIT_MS || 2_000,
      ),
      maxRetryAfterMs: Number(
        process.env.SUGGESTED_QUESTIONS_AI_MAX_RETRY_AFTER_MS || 0,
      ),
      attempts: Number(process.env.SUGGESTED_QUESTIONS_AI_ATTEMPTS || 1),
      generationConfig: {
        temperature: Number(process.env.SUGGESTED_QUESTIONS_AI_TEMPERATURE || 0.2),
        maxOutputTokens: Number(
          process.env.SUGGESTED_QUESTIONS_AI_MAX_OUTPUT_TOKENS || 350,
        ),
      },
    },
  );
  return parseSuggestedQuestions(responseText(response));
};

const parseJsonResponse = (value) => {
  const normalized = String(value || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The comparison model returned an invalid response.");
  }
  return JSON.parse(normalized.slice(start, end + 1));
};

const generateDocumentComparison = async ({
  mode,
  language,
  userQuestion,
  documents,
  context,
}) => {
  const responseLanguage =
    language === "hindi"
      ? "Hindi"
      : language === "english"
        ? "English"
        : "the language used in the focused question, otherwise English";
  const buildPrompt = (sourceContext) => `
Compare the supplied Indian legislative and public-policy documents using only
the labelled source passages. Never use a document title as evidence. Every
substantive claim must include one or more citation labels exactly as supplied
(for example "[D1-C2]"). If evidence is absent, say "Not identified in the
retrieved text." Keep the documents distinct and do not merge their provisions.
Do not leave a section empty when the supplied passages contain relevant
evidence. For each major section, produce as many useful non-duplicative cited
items as the evidence supports; prefer 4-8 items for similarities, differences,
stakeholders, compliance impact, authority differences, impact assessment and
key findings, and 2-5 timeline items when dates exist.
Identify stakeholders from cited text such as Government, Council, proper
officer, Appellate Authority/Tribunal, registered persons, taxable persons,
manufacturers, suppliers, sectors or institutions. Identify timeline items from
commencement, ordinance, introduction, notification, Gazette, memorandum, date
or year evidence. Authority differences should explain how powers, duties,
rule-making, enforcement, appeal or administration differ between documents.
Compliance and impact items should explain practical consequences for taxpayers,
regulated entities, administrators and affected sectors.
Be detailed and research-useful: each item should state what changed, who is
affected, why it matters, and which cited passage supports it. Avoid generic
phrases such as "processed through Rashtram AI" unless the provider fallback is
used outside this prompt.
Clearly label analytical inference and uncertainty. Earlier assistant text,
document summaries, and model knowledge are not evidence. Never invent missing
pages, sections, dates, amendments, institutions, or legal effects. If sources
conflict, describe both cited positions and do not silently select one.

Comparison mode: ${mode}
Response language: ${responseLanguage}
Focused comparison question: ${userQuestion || "None; provide the requested mode."}
Documents:
${JSON.stringify(documents)}

Return only valid JSON with this shape:
{
  "executiveSummary": "string",
  "similarities": [{"point":"string","citations":["D1-C1"]}],
  "differences": [{"topic":"string","analysis":"string","citations":["D1-C1","D2-C1"]}],
  "keyClauses": [{"documentId":"string","clause":"string","analysis":"string","citations":["D1-C1"]}],
  "stakeholders": [{"name":"string","impact":"string","citations":["D1-C1"]}],
  "complianceImpact": [{"point":"string","citations":["D1-C1"]}],
  "timeline": [{"date":"string","event":"string","documentId":"string","citations":["D1-C1"]}],
  "authorityDifferences": [{"point":"string","citations":["D1-C1"]}],
  "impactAssessment": [{"point":"string","citations":["D1-C1"]}],
  "keyFindings": [{"point":"string","citations":["D1-C1"]}],
  "suggestedQuestions": ["string"]
}

Source passages:
${sourceContext}
`;
  const generate = async (sourceContext, overrides = {}) => {
    const response = await runGeneration(
      "generateContent",
      buildPrompt(sourceContext),
      {
        // Comparisons are an interactive product path. Do not let the shared
        // generation circuit breaker fail them instantly after unrelated burst
        // errors from chat, health checks, or background jobs. The rate limiter
        // still protects the Gemini key, and createComparison has a grounded
        // fallback if every model attempt fails.
        useCircuitBreaker: false,
        models: taskGenerationModels("comparison"),
        timeoutMs: Number(
          overrides.timeoutMs || process.env.COMPARISON_AI_TIMEOUT_MS || 22_000,
        ),
        attempts: Number(process.env.COMPARISON_AI_ATTEMPTS || 1),
        maxQueueWaitMs: Number(
          process.env.COMPARISON_AI_MAX_QUEUE_WAIT_MS || 4_000,
        ),
        maxRetryAfterMs: Number(
          process.env.COMPARISON_AI_MAX_RETRY_AFTER_MS || 0,
        ),
        maxModels: Number(
          overrides.maxModels || process.env.COMPARISON_AI_MAX_MODELS || 1,
        ),
        generationConfig: {
          temperature: Number(process.env.COMPARISON_AI_TEMPERATURE || 0.1),
          responseMimeType: "application/json",
          maxOutputTokens: Number(
            overrides.maxOutputTokens ||
              process.env.COMPARISON_AI_MAX_OUTPUT_TOKENS ||
              3_200,
          ),
        },
      },
    );
    const rawText = responseText(response);
    try {
      return parseJsonResponse(rawText);
    } catch (error) {
      error.comparisonJsonParseFailure = true;
      error.rawComparisonResponse = rawText;
      throw error;
    }
  };

  const repairJson = async (rawText) => {
    const repairPrompt = `
Repair the following malformed comparison JSON into valid JSON only.
Do not add Markdown. Do not explain the repair.
Preserve the existing comparison content where possible.
If a field is broken or incomplete, close it safely or use an empty array.
The output must be one JSON object with these keys:
executiveSummary, similarities, differences, keyClauses, stakeholders,
complianceImpact, timeline, authorityDifferences, impactAssessment,
keyFindings, suggestedQuestions.

Malformed JSON:
${String(rawText || "").slice(0, 16_000)}
`;
    const response = await runGeneration("generateContent", repairPrompt, {
      useCircuitBreaker: false,
      models: taskGenerationModels("comparison"),
      timeoutMs: Number(process.env.COMPARISON_JSON_REPAIR_TIMEOUT_MS || 8_000),
      attempts: 1,
      maxQueueWaitMs: Number(
        process.env.COMPARISON_JSON_REPAIR_MAX_QUEUE_WAIT_MS || 2_000,
      ),
      maxRetryAfterMs: 0,
      maxModels: 1,
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        maxOutputTokens: Number(
          process.env.COMPARISON_JSON_REPAIR_MAX_OUTPUT_TOKENS || 2_400,
        ),
      },
    });
    return parseJsonResponse(responseText(response));
  };

  try {
    return await generate(context);
  } catch (error) {
    if (error.comparisonJsonParseFailure && error.rawComparisonResponse) {
      return repairJson(error.rawComparisonResponse);
    }
    const compactLimit = Number(
      process.env.COMPARISON_COMPACT_CONTEXT_CHAR_LIMIT || 18_000,
    );
    const compactContext = String(context || "").slice(0, compactLimit);
    if (compactContext && compactContext.length < String(context || "").length) {
      try {
        return await generate(compactContext, {
          timeoutMs: Number(
            process.env.COMPARISON_COMPACT_AI_TIMEOUT_MS || 8_000,
          ),
          maxModels: 2,
          maxOutputTokens: Number(
            process.env.COMPARISON_COMPACT_AI_MAX_OUTPUT_TOKENS || 2_400,
          ),
        });
      } catch (compactError) {
        if (
          compactError.comparisonJsonParseFailure &&
          compactError.rawComparisonResponse
        ) {
          return repairJson(compactError.rawComparisonResponse);
        }
        compactError.cause = error;
        throw compactError;
      }
    }
    throw error;
  }
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

const verifyDocumentRelationship = async ({
  sourceDocument,
  targetDocument,
  proposedRelationship,
  evidence,
}) => {
  const prompt = `
You verify proposed relationships between Indian government documents. Use only
the supplied document metadata and evidence. Reject the relationship unless the
evidence explicitly supports it. Do not infer legal effect from similar titles
alone.

Return only valid JSON:
{
  "supported": true,
  "relationshipType": "UPPER_SNAKE_CASE",
  "confidence": 0.0,
  "explanation": "one concise evidence-based sentence",
  "evidenceQuote": "short supplied excerpt or empty string"
}

Source document:
${JSON.stringify(sourceDocument)}

Target document:
${JSON.stringify(targetDocument)}

Proposed relationship: ${proposedRelationship}
Evidence:
${JSON.stringify(evidence)}
`;
  const response = await runGeneration("generateContent", prompt);
  const parsed = parseJsonResponse(responseText(response));
  return {
    supported: parsed.supported === true,
    relationshipType: String(parsed.relationshipType || "")
      .trim()
      .toUpperCase(),
    confidence: Math.min(Math.max(Number(parsed.confidence || 0), 0), 1),
    explanation: String(parsed.explanation || "").trim().slice(0, 1_000),
    evidenceQuote: String(parsed.evidenceQuote || "").trim().slice(0, 1_000),
  };
};

const generateBillSummary = (billContent) =>
  generateDocumentSummary("bill", billContent);

const generateActSummary = (actContent) =>
  generateDocumentSummary("act", actContent);

const generateEGazetteSummary = (content) =>
  generateDocumentSummary("gazette", content);

const generatePolicySummary = (content) =>
  generateDocumentSummary("policy", content);

const searchContent = async (index, idField, id, query, topK = 5) => {
  const queryEmbeddingResult = await generateEmbeddingWithMetrics(query);
  const pineconeStartedAt = Date.now();
  const searchResults = await index.query({
    vector: queryEmbeddingResult.vector,
    topK,
    filter: { [idField]: { $eq: String(id) } },
    includeMetadata: true,
  });

  const matches = (searchResults.matches || []).map((match) => ({
    ...match,
    relevanceScore: match.score,
    content: match.metadata?.content || "",
    chunkInfo: {
      index: match.metadata?.chunkIndex || 0,
      total: match.metadata?.totalChunks || 1,
      source: match.metadata?.source || "pdf",
    },
  }));
  matches.metrics = {
    queryEmbeddingMs: queryEmbeddingResult.elapsedMs,
    queryEmbeddingCache: queryEmbeddingResult.cacheStatus,
    pineconeMs: Date.now() - pineconeStartedAt,
  };
  return matches;
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

const searchSimilarContentForPolicy = (query, policyId, topK = 5) =>
  searchContent(
    getPolicyIndex(),
    "policyId",
    policyId,
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

const searchIndexedPolicyIds = async (query, topK = 100) => {
  if (!String(query || "").trim()) return [];
  const queryEmbedding = await generateEmbedding(query);
  const result = await getPolicyIndex().query({
    vector: queryEmbedding,
    topK,
    filter: { policyId: { $exists: true } },
    includeMetadata: true,
  });
  return [
    ...new Set(
      (result.matches || [])
        .map((match) => match.metadata?.policyId)
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
  // Chunk IDs whose content hash and embedding namespace are unchanged
  // since the last successful run — Pinecone already has a valid vector at
  // that exact deterministic ID, so they're skipped from both embedding
  // and upsert. `chunks` itself stays the FULL set (unfiltered) so
  // cleanupStaleVectors below still sees the complete expected ID set;
  // only the embed/upsert loop is narrowed.
  unchangedChunkIds = new Set(),
}) => {
  let totalStored = 0;
  let embeddingsMs = 0;
  let pineconeMs = 0;
  const chunksToEmbed = unchangedChunkIds.size
    ? chunks.filter((chunk) => !unchangedChunkIds.has(chunk.id))
    : chunks;
  const embeddingCacheHits = chunks.length - chunksToEmbed.length;

  for (
    let start = 0;
    start < chunksToEmbed.length;
    start += EMBEDDING_BATCH_SIZE
  ) {
    const batch = chunksToEmbed.slice(start, start + EMBEDDING_BATCH_SIZE);
    const embeddingStartedAt = Date.now();
    const embeddings = await generateEmbeddings(
      batch.map((chunk) => chunk.embeddingText || chunk.content),
      "RETRIEVAL_DOCUMENT",
    );
    embeddingsMs += Date.now() - embeddingStartedAt;
    const vectors = batch.map((chunk, index) => {
      const metadata = {
        [idField]: String(
          chunk[chunkIdField] ?? chunk.billId ?? chunk.documentId,
        ),
        [titleField]: chunk.title,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        timestamp: new Date().toISOString(),
        embeddingProvider: EMBEDDING_PROVIDER,
        embeddingModel: EMBEDDING_MODEL,
        embeddingDimension: EMBEDDING_DIMENSION,
        vectorNamespace: VECTOR_NAMESPACE,
        ...chunk.metadata,
      };
      return {
        id: chunk.id,
        values: embeddings[index],
        metadata: Object.fromEntries(
          Object.entries(metadata).filter(
            ([, value]) => value !== null && value !== undefined,
          ),
        ),
      };
    });

    const pineconeStartedAt = Date.now();
    await upsertWithRetry(index, vectors);
    pineconeMs += Date.now() - pineconeStartedAt;
    totalStored += vectors.length;
  }

  const staleVectorsRemoved = await cleanupStaleVectors({
    chunks,
    index,
    idField,
    chunkIdField,
  });

  return {
    chunksStored: totalStored,
    success: true,
    metrics: { embeddingsMs, pineconeMs },
    staleVectorsRemoved,
    embeddingCacheHits,
    embeddingCacheMisses: chunksToEmbed.length,
  };
};

// Large-document parents are routing representations, not source chunks.
// They are upserted separately so indexing them can never delete or relabel
// ordinary child vectors for the same document.
const storeRoutingRepresentations = async ({
  representations, index, idField, titleField,
}) => {
  if (!Array.isArray(representations) || representations.length === 0 || representations.length > 500) {
    throw new Error("Routing representation batch must contain between 1 and 500 items.");
  }
  let embeddingsMs = 0;
  let pineconeMs = 0;
  let stored = 0;
  for (let start = 0; start < representations.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = representations.slice(start, start + EMBEDDING_BATCH_SIZE);
    const embeddingStartedAt = Date.now();
    const embeddings = await generateEmbeddings(
      batch.map((item) => item.embeddingText),
      "RETRIEVAL_DOCUMENT",
    );
    embeddingsMs += Date.now() - embeddingStartedAt;
    const vectors = batch.map((item, indexValue) => ({
      id: item.id,
      values: embeddings[indexValue],
      metadata: Object.fromEntries(Object.entries({
        [idField]: String(item.documentId),
        [titleField]: item.title,
        content: item.embeddingText,
        chunkIndex: item.groupIndex,
        totalChunks: representations.length,
        routingOnly: true,
        structuralType: "large_document_group",
        childStart: item.childStart,
        childEnd: item.childEnd,
        groupTitle: item.groupTitle,
        vectorNamespace: VECTOR_NAMESPACE,
        ...item.metadata,
      }).filter(([, value]) => value !== null && value !== undefined)),
    }));
    const pineconeStartedAt = Date.now();
    await upsertWithRetry(index, vectors);
    pineconeMs += Date.now() - pineconeStartedAt;
    stored += vectors.length;
  }
  return { stored, embeddingsMs, pineconeMs };
};

// Reprocessing a document can produce fewer chunks than the previous run
// (content shrank, or chunking logic changed). Pinecone upserts only ever
// add/overwrite by ID, so without this step the old chunk indices beyond
// the new count would remain in the index forever as stale vectors —
// producing wrong citations, duplicated context, or outdated answers on
// retrieval. Best-effort: a cleanup failure must never fail the store that
// already succeeded above, so it's caught and logged, not thrown.
const cleanupStaleVectors = async ({ chunks, index, idField, chunkIdField }) => {
  const documentIdValue = String(
    chunks[0]?.[chunkIdField] ?? chunks[0]?.billId ?? chunks[0]?.documentId ?? "",
  );
  if (!documentIdValue) return 0;

  try {
    const newIds = new Set(chunks.map((chunk) => chunk.id));
    const queryResults = await index.query({
      vector: createProbeVector(),
      topK: 1000,
      filter: { [idField]: { $eq: documentIdValue } },
      includeMetadata: false,
    });
    const existingIds = (queryResults.matches || []).map((match) => match.id);
    if (existingIds.length === 1000) {
      console.warn(
        `Stale-vector cleanup for ${idField}=${documentIdValue} hit the 1000-match query cap; some stale vectors may not have been found.`,
      );
    }

    const staleIds = existingIds.filter((id) => !newIds.has(id));
    if (staleIds.length === 0) return 0;

    await index.deleteMany(staleIds);
    return staleIds.length;
  } catch (error) {
    console.warn(
      `Stale-vector cleanup failed for ${idField}=${documentIdValue}; leaving existing vectors in place: ${error.message}`,
    );
    return 0;
  }
};

const storeBillContentInChunks = (chunks, options = {}) =>
  storeContentInChunks({
    chunks,
    index: getIndex(),
    idField: "billId",
    titleField: "billTitle",
    ...options,
  });

const storeActContentInChunks = (chunks, options = {}) =>
  storeContentInChunks({
    chunks,
    index: getActIndex(),
    idField: "actId",
    titleField: "actTitle",
    ...options,
  });

const storeEGazetteContentInChunks = (chunks, options = {}) =>
  storeContentInChunks({
    chunks,
    index: getEGazetteIndex(),
    idField: "gazetteId",
    titleField: "gazetteTitle",
    chunkIdField: "gazetteId",
    ...options,
  });

const storePolicyContentInChunks = (chunks, options = {}) =>
  storeContentInChunks({
    chunks,
    index: getPolicyIndex(),
    idField: "policyId",
    titleField: "policyTitle",
    chunkIdField: "policyId",
    ...options,
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
  buildEmbeddingBatches,
  checkActExists,
  checkBillExists,
  checkEGazetteExists,
  checkPolicyExists,
  cleanupStaleVectors,
  createProbeVector,
  findSimilarBills,
  generateActSummary,
  generateBillSummary,
  generateDocumentSummary,
  generateDocumentComparison,
  generateDashboardOverview,
  generateEGazetteSummary,
  generatePolicySummary,
  generateEmbedding,
  generateEmbeddings,
  generateLocalEmbedding,
  runGeneration,
  estimateEmbeddingTokens,
  generateResponse,
  generatePolicyDraft,
  generateSuggestedQuestions,
  verifyDocumentRelationship,
  getActIndex,
  getEGazetteIndex,
  getIndex,
  getPolicyIndex,
  normalizeResponseLanguage,
  parseSuggestedQuestions,
  providerConfig,
  responseText,
  searchSimilarContent,
  searchSimilarContentForAct,
  searchSimilarContentForEGazette,
  searchSimilarContentForPolicy,
  searchIndexedEGazetteIds,
  searchIndexedPolicyIds,
  storeActContentInChunks,
  storeBillContent,
  storeBillContentInChunks,
  storeContentInChunks,
  storeEGazetteContentInChunks,
  storePolicyContentInChunks,
  storeRoutingRepresentations,
  validateAIProvider,
};
