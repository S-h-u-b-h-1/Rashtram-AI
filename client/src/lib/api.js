

import { consumeSSEStream } from "@/lib/chat-stream";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
const DEFAULT_GET_CACHE_TTL_MS = Number(
  process.env.NEXT_PUBLIC_API_GET_CACHE_TTL_MS || 15_000,
);
const getRequestCache = new Map();
const pendingGetRequests = new Map();
const cacheableGetRoutes = [
  { pattern: /^\/dashboard\/intelligence$/, ttl: 30_000 },
  { pattern: /^\/dashboard\/source-health$/, ttl: 60_000 },
  { pattern: /^\/profile(?:\/|$)/, ttl: 20_000 },
  { pattern: /^\/auth\/me$/, ttl: 10_000 },
  { pattern: /^\/onboarding$/, ttl: 10_000 },
  { pattern: /^\/documents(?:\/|\?|$)/, ttl: DEFAULT_GET_CACHE_TTL_MS },
  { pattern: /^\/document-chat\/document\//, ttl: 60_000 },
  { pattern: /^\/document-chat\/history(?:\/|\?|$)/, ttl: DEFAULT_GET_CACHE_TTL_MS },
  { pattern: /^\/documents\/chat\/history(?:\/|\?|$)/, ttl: DEFAULT_GET_CACHE_TTL_MS },
  { pattern: /^\/graph(?:\/|\?|$)/, ttl: DEFAULT_GET_CACHE_TTL_MS },
  { pattern: /^\/recommendations(?:\/|\?|$)/, ttl: DEFAULT_GET_CACHE_TTL_MS },
  { pattern: /^\/activity\/preferences$/, ttl: 20_000 },
];

const getCacheTtl = (endpoint) => {
  const route = cacheableGetRoutes.find(({ pattern }) => pattern.test(endpoint));
  return route?.ttl || 0;
};

export const clearApiCache = () => {
  getRequestCache.clear();
  pendingGetRequests.clear();
};

let authCapabilitiesCache;
let pendingAuthCapabilitiesRequest;

export const getAuthCapabilities = async ({ signal } = {}) => {
  if (!signal && authCapabilitiesCache?.expiresAt > Date.now()) {
    return authCapabilitiesCache.value;
  }
  if (!signal && pendingAuthCapabilitiesRequest) {
    return pendingAuthCapabilitiesRequest;
  }

  const request = fetch(`${API_BASE_URL}/auth/capabilities`, { signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Authentication capabilities are unavailable.");
      }
      return response.json();
    })
    .then((value) => {
      if (!signal) {
        authCapabilitiesCache = {
          value,
          expiresAt: Date.now() + 60_000,
        };
      }
      return value;
    })
    .finally(() => {
      if (!signal) pendingAuthCapabilitiesRequest = null;
    });

  if (!signal) pendingAuthCapabilitiesRequest = request;
  return request;
};


export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('auth-token') || localStorage.getItem('auth-token');
};

export const clearAuthTokens = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth-token");
  sessionStorage.removeItem("auth-token");
  clearApiCache();
};

export const storeAuthToken = (token, { persistent = false } = {}) => {
  clearAuthTokens();
  if (!token || typeof window === "undefined") return;
  const storage = persistent ? localStorage : sessionStorage;
  storage.setItem("auth-token", token);
};

export const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();

  if (!token) {
    throw new Error('No authentication token found. Please login.');
  }

  const { skipCache, ...fetchOptions } = options;
  const method = (fetchOptions.method || "GET").toUpperCase();
  const cacheTtl = getCacheTtl(endpoint);
  const canUseCache =
    method === "GET" &&
    !skipCache &&
    !fetchOptions.signal &&
    fetchOptions.cache !== "no-store" &&
    cacheTtl > 0;
  const cacheKey = canUseCache ? `${token}:${endpoint}` : null;

  if (cacheKey) {
    const cached = getRequestCache.get(cacheKey);
    if (cached?.expiresAt > Date.now()) {
      return cached.value;
    }
    if (pendingGetRequests.has(cacheKey)) {
      return pendingGetRequests.get(cacheKey);
    }
  }

  const config = {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      'auth-token': token,
      ...fetchOptions.headers,
    },
  };

  const request = fetch(`${API_BASE_URL}${endpoint}`, config)
    .then(async (response) => {
      if (!response.ok) {
        if (response.status === 401) {

          if (getAuthToken() === token) clearAuthTokens();
          throw new Error('Session expired. Please login again.');
        }
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.message ||
            error.error ||
            `Request failed with status ${response.status}`
        );
      }

      const value = await response.json();
      if (cacheKey) {
        getRequestCache.set(cacheKey, {
          value,
          expiresAt: Date.now() + cacheTtl,
        });
      } else if (method !== "GET") {
        clearApiCache();
      }
      return value;
    })
    .finally(() => {
      if (cacheKey) pendingGetRequests.delete(cacheKey);
    });

  if (cacheKey) {
    pendingGetRequests.set(cacheKey, request);
  }

  return request;
};

export const submitContactRequest = async (payload) => {
  const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_CONTACT_ENDPOINT;
  if (!endpoint) {
    throw new Error("Contact form delivery is not configured.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const formError = Array.isArray(result.errors)
      ? result.errors.map((error) => error.message).filter(Boolean).join(" ")
      : "";
    throw new Error(
      formError || result.error || "Unable to send your message.",
    );
  }
  return result;
};


const toQueryString = (values) => {
  const parameters = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "All") {
      parameters.set(key, String(value));
    }
  });
  return parameters.toString();
};


export const getDocumentResearch = async (documentType, documentId) => {
  return apiRequest(
    `/document-chat/document/${encodeURIComponent(
      documentType,
    )}/${encodeURIComponent(documentId)}`,
  );
};

export const getResearchSources = async () =>
  apiRequest("/research-sources");

export const addResearchUrlSource = async (url) =>
  apiRequest("/research-sources/url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });

export const addResearchPdfSource = async (file) => {
  const contentBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
    reader.onerror = () => reject(new Error("The PDF could not be read."));
    reader.readAsDataURL(file);
  });
  return apiRequest("/research-sources/upload", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      contentBase64,
    }),
  });
};

export const deleteResearchSource = async (sourceId) =>
  apiRequest(`/research-sources/${encodeURIComponent(sourceId)}`, {
    method: "DELETE",
  });

export const getPolicyDrafts = async (limit = 20) =>
  apiRequest(`/policy-drafts?limit=${encodeURIComponent(limit)}`);

export const createPolicyDraft = async ({
  title,
  objective,
  audience,
  geography,
  requirements,
  responseLanguage = "English",
  documentIds = [],
  sourceIds = [],
  onChunk,
  onMeta,
  signal,
}) => {
  const token = getAuthToken();
  if (!token) throw new Error("No authentication token found. Please login.");
  const response = await fetch(`${API_BASE_URL}/policy-drafts/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "auth-token": token,
    },
    body: JSON.stringify({
      title,
      objective,
      audience,
      geography,
      requirements,
      responseLanguage,
      documentIds,
      sourceIds,
    }),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || payload.message || `Request failed with ${response.status}`);
  }
  let draftId = null;
  let citations = [];
  let fullText = "";
  await consumeSSEStream(response, {
    signal,
    onEvent: (event) => {
      if (event.type === "meta") {
        draftId = event.draftId || null;
        citations = event.citations || [];
        onMeta?.(event);
      } else if (event.type === "content") {
        fullText += event.content || "";
        onChunk?.(event.content || "");
      } else if (event.type === "error") {
        throw new Error(event.error || "Policy drafting was interrupted.");
      }
    },
  });
  return { draftId, citations, draftText: fullText };
};

export const fetchDocuments = async (options = {}) => {
  // Keep transport-only options out of the query string.  In particular,
  // DocumentExplorer passes an AbortSignal so a newer filter/search request
  // can cancel an older one instead of allowing stale results to win.
  const { signal, skipCache, ...queryOptions } = options;
  return apiRequest(`/documents?${toQueryString(queryOptions)}`, {
    signal,
    skipCache,
  });
};

export const searchDocuments = async (query, options = {}) => {
  return apiRequest(
    `/documents/search?${toQueryString({
      ...options,
      q: query,
    })}`,
  );
};

export const fetchDocument = async (documentId) => {
  return apiRequest(`/documents/${encodeURIComponent(documentId)}`);
};

export const createDocumentComparison = async (payload) => {
  return apiRequest("/documents/compare", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const getDocumentComparison = async (comparisonId) => {
  return apiRequest(
    `/documents/compare/${encodeURIComponent(comparisonId)}`,
  );
};

export const deleteDocumentComparison = async (comparisonId) => {
  return apiRequest(
    `/documents/compare/${encodeURIComponent(comparisonId)}`,
    { method: "DELETE" },
  );
};

export const getDocumentComparisons = async (limit = 30) => {
  return apiRequest(`/profile/comparisons?limit=${encodeURIComponent(limit)}`);
};

export const getDocumentRecommendations = async (
  documentId,
  options = {},
) => {
  return apiRequest(
    `/documents/${encodeURIComponent(documentId)}/recommendations?${toQueryString(
      options,
    )}`,
  );
};

export const recommendDocumentsForComparison = async (payload) =>
  apiRequest("/documents/recommend-for-comparison", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getDocumentReadiness = async (documentId) =>
  apiRequest(`/documents/${encodeURIComponent(documentId)}/readiness`);

export const prepareDocumentForComparison = async (documentId) =>
  apiRequest(`/documents/${encodeURIComponent(documentId)}/prepare`, {
    method: "POST",
  });

export const getRecentRecommendations = async (limit = 12) => {
  return apiRequest(
    `/profile/recommendations?limit=${encodeURIComponent(limit)}`,
  );
};

export const recommendForProblem = async (payload) => {
  return apiRequest("/recommendations/problem", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const fetchDocumentTimeline = async (documentId) => {
  return apiRequest(
    `/documents/${encodeURIComponent(documentId)}/timeline`,
  );
};

export const fetchDocumentGraph = async (documentId, options = {}) => {
  return apiRequest(
    `/documents/${encodeURIComponent(documentId)}/graph?${toQueryString(
      options,
    )}`,
  );
};

export const fetchDocumentRelationships = async (
  documentId,
  options = {},
) =>
  apiRequest(
    `/documents/${encodeURIComponent(documentId)}/relationships?${toQueryString(
      options,
    )}`,
  );

export const searchKnowledgeGraph = async (query, options = {}) =>
  apiRequest(
    `/graph/search?${toQueryString({ ...options, q: query })}`,
  );

export const findKnowledgeGraphPath = async (
  sourceDocumentId,
  targetDocumentId,
  maxDepth = 6,
) =>
  apiRequest(
    `/graph/path?${toQueryString({
      from: sourceDocumentId,
      to: targetDocumentId,
      maxDepth,
    })}`,
  );

export const saveKnowledgeGraphPath = async (payload) =>
  apiRequest("/graph/paths", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const sendCrossDocumentChat = async (
  {
    message,
    documentIds,
    onChunk,
    responseLanguage = "English",
    comparisonId = null,
    sourceIds = [],
    signal,
  },
) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found. Please login.");
  }
  const response = await fetch(`${API_BASE_URL}/documents/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "auth-token": token,
    },
    body: JSON.stringify({
      message,
      documentIds,
      responseLanguage,
      comparisonId,
      sourceIds,
    }),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  let fullResponse = "";
  let sources = [];
  let metadata = {};
  await consumeSSEStream(response, {
    signal,
    onEvent: (event) => {
      if (event.type === "meta") {
        sources = event.sources || [];
        metadata = event.metadata || {};
      } else if (event.type === "content") {
        fullResponse += event.content || "";
        onChunk?.(event.content || "");
      } else if (event.type === "error") {
        throw new Error(event.error || "Response generation failed.");
      }
    },
  });
  return { response: fullResponse, sources, metadata };
};

export const getCrossDocumentChatHistory = async (documentIds) =>
  apiRequest(
    `/documents/chat/history?${toQueryString({
      ids: documentIds.join(","),
    })}`,
  );

export const clearCrossDocumentChatHistory = async (documentIds) =>
  apiRequest(
    `/documents/chat/history?${toQueryString({
      ids: documentIds.join(","),
    })}`,
    { method: "DELETE" },
  );

export const processDocumentResearch = async (
  documentType,
  documentId,
) => {
  return prepareDocumentForComparison(documentId);
};

export const createDocumentChatSession = async (
  documentType,
  documentId,
  summary,
) => {
  return apiRequest("/document-chat/session", {
    method: "POST",
    body: JSON.stringify({ documentType, documentId, summary }),
  });
};

export const getDocumentChatHistory = async (
  documentType,
  documentId,
) => {
  return apiRequest(
    `/document-chat/history?${toQueryString({
      documentType,
      documentId,
    })}`,
  );
};

export const getRecentDocumentChats = async (limit = 8) => {
  return apiRequest(
    `/document-chat/history?${toQueryString({ limit })}`,
  );
};

export const addDocumentChatMessage = async (
  documentType,
  documentId,
  message,
) => {
  return apiRequest("/document-chat/message", {
    method: "POST",
    body: JSON.stringify({ documentType, documentId, ...message }),
  });
};

export const updateDocumentChatSummary = async (
  documentType,
  documentId,
  summary,
) => {
  return apiRequest("/document-chat/summary", {
    method: "PATCH",
    body: JSON.stringify({ documentType, documentId, summary }),
  });
};

export const clearDocumentChat = async (documentType, documentId) => {
  return apiRequest(
    `/document-chat/history?${toQueryString({
      documentType,
      documentId,
    })}`,
    { method: "DELETE" },
  );
};

export const pinDocumentChat = async (
  documentType,
  documentId,
  isPinned,
) => {
  return apiRequest("/document-chat/pin", {
    method: "PATCH",
    body: JSON.stringify({ documentType, documentId, isPinned }),
  });
};

export const addDocumentNote = async (
  documentType,
  documentId,
  body,
) => {
  return apiRequest("/document-chat/notes", {
    method: "POST",
    body: JSON.stringify({ documentType, documentId, body }),
  });
};

export const deleteDocumentNote = async (noteId) => {
  return apiRequest(`/document-chat/notes/${encodeURIComponent(noteId)}`, {
    method: "DELETE",
  });
};

export const sendDocumentChatFeedback = async ({
  documentType,
  documentId,
  messageId,
  rating,
}) => {
  return apiRequest("/document-chat/feedback", {
    method: "POST",
    body: JSON.stringify({
      documentType,
      documentId,
      messageId,
      rating,
    }),
  });
};

export const sendDocumentChatMessage = async (
  {
    message,
    documentType,
    documentId,
    onChunk,
    responseLanguage = "English",
    sourceIds = [],
    workflow,
    signal,
  },
) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found. Please login.");
  }
  const response = await fetch(`${API_BASE_URL}/document-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "auth-token": token,
    },
    body: JSON.stringify({
      message,
      documentType,
      documentId,
      responseLanguage,
      sourceIds,
      workflow,
    }),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload.error ||
        payload.message ||
        `Request failed with status ${response.status}`,
    );
  }
  let sources = [];
  let metadata = {};
  let fullResponse = "";
  await consumeSSEStream(response, {
    signal,
    onEvent: (event) => {
      if (event.type === "meta") {
        sources = event.sources || [];
        metadata = event.metadata || {};
      } else if (event.type === "content") {
        fullResponse += event.content || "";
        onChunk?.(event.content || "");
      } else if (event.type === "error") {
        throw new Error(event.error || "Response generation failed.");
      }
    },
  });
  return { response: fullResponse, sources, metadata };
};

const downloadAuthenticatedFile = async (endpoint, filename) => {
  const token = getAuthToken();
  if (!token) throw new Error("Please sign in again.");
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { "auth-token": token },
  });
  if (!response.ok) throw new Error("Export failed.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const exportDocumentChat = (documentType, documentId) =>
  downloadAuthenticatedFile(
    `/document-chat/export?${toQueryString({
      documentType,
      documentId,
    })}`,
    `rashtram-${documentType}-${documentId}.md`,
  );


export const getDashboardData = async () => {
  try {
    const data = await apiRequest('/dashboard');
    return data;
  } catch (error) {
    throw error;
  }
};

export const getDashboardIntelligence = async () => {
  return apiRequest("/dashboard/intelligence");
};

export const getProfile = async () => {
  return apiRequest("/profile");
};

export const updateProfile = async (profile) => {
  return apiRequest("/profile", {
    method: "PATCH",
    body: JSON.stringify(profile),
  });
};

export const getAuthState = async () => {
  return apiRequest("/auth/me");
};

export const getOnboarding = async () => {
  return apiRequest("/onboarding");
};

export const saveOnboarding = async (payload) => {
  return apiRequest("/onboarding", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const completeOnboarding = async (payload) => {
  return apiRequest("/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const skipOnboarding = async () => {
  return apiRequest("/onboarding/skip", {
    method: "POST",
    body: JSON.stringify({}),
  });
};

export const changePassword = async (currentPassword, newPassword) => {
  return apiRequest("/profile/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};

export const deleteAccount = async ({ confirmation, password } = {}) => {
  return apiRequest("/profile", {
    method: "DELETE",
    body: JSON.stringify({ confirmation, password }),
  });
};

export const saveContent = async (item) => {
  return apiRequest("/profile/saved", {
    method: "POST",
    body: JSON.stringify(item),
  });
};

export const removeSavedContent = async (id) => {
  return apiRequest(`/profile/saved/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
};

export const saveSearch = async (search) => {
  return apiRequest("/profile/saved-searches", {
    method: "POST",
    body: JSON.stringify(search),
  });
};

export const createResearchCollection = async (collection) => {
  return apiRequest("/profile/collections", {
    method: "POST",
    body: JSON.stringify(collection),
  });
};

export const addResearchCollectionItem = async (collectionId, item) => {
  return apiRequest(
    `/profile/collections/${encodeURIComponent(collectionId)}/items`,
    {
      method: "POST",
      body: JSON.stringify(item),
    },
  );
};

export const revokeSession = async (sessionId) => {
  return apiRequest(`/profile/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
};

export const exportProfileData = () =>
  downloadAuthenticatedFile(
    "/profile/export",
    `rashtram-research-export-${Date.now()}.json`,
  );

export const getSourceHealth = async () => {
  return apiRequest("/dashboard/source-health");
};

const recentActivityEvents = new Map();
let searchActivityTimer = null;

const getActivitySessionId = () => {
  if (typeof window === "undefined") return null;
  const key = "rashtram-activity-session";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId =
      globalThis.crypto?.randomUUID?.() ||
      `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

export const trackActivity = async (event) => {
  if (typeof window === "undefined") return { tracked: false };
  const token = getAuthToken();
  if (!token) return { tracked: false };

  const payload = {
    ...event,
    session_id: getActivitySessionId(),
  };
  const signature = JSON.stringify([
    payload.event_type,
    payload.entity_type,
    payload.entity_id,
    payload.document_id,
    payload.page_path,
    payload.search_query,
    payload.filters_json,
  ]);
  const now = Date.now();
  if (now - (recentActivityEvents.get(signature) || 0) < 2_000) {
    return { tracked: false, reason: "duplicate_suppressed" };
  }
  if (recentActivityEvents.size > 200) {
    for (const [key, timestamp] of recentActivityEvents) {
      if (now - timestamp > 60_000) recentActivityEvents.delete(key);
    }
  }
  recentActivityEvents.set(signature, now);

  try {
    const response = await fetch(`${API_BASE_URL}/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": token,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (response.status === 401) {
      if (getAuthToken() === token) clearAuthTokens();
      return { tracked: false, reason: "session_expired" };
    }
    return await response.json().catch(() => ({ tracked: false }));
  } catch {
    return { tracked: false };
  }
};

export const trackSearchActivity = (event, delayMs = 700) => {
  if (searchActivityTimer) clearTimeout(searchActivityTimer);
  searchActivityTimer = setTimeout(() => {
    trackActivity(event);
  }, delayMs);
};

export const getActivityPreferences = async () => {
  return apiRequest("/activity/preferences");
};

export const updateActivityPreferences = async (preferences) => {
  return apiRequest("/activity/preferences", {
    method: "PATCH",
    body: JSON.stringify(preferences),
  });
};


export const getUser = async () => {
  try {
    const data = await getAuthState();
    return data;
  } catch (error) {
    console.error('Error fetching user details:', error);
    throw error;
  }
};
