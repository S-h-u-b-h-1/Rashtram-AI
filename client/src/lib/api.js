

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';


const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth-token') || sessionStorage.getItem('auth-token');
};


export const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();

  if (!token) {
    throw new Error('No authentication token found. Please login.');
  }

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'auth-token': token,
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    if (response.status === 401) {

      localStorage.removeItem('auth-token');
      sessionStorage.removeItem('auth-token');
      throw new Error('Session expired. Please login again.');
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message ||
        error.error ||
        `Request failed with status ${response.status}`
    );
  }

  return response.json();
};

export const submitContactRequest = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "Unable to send your message.");
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

export const fetchDocuments = async (options = {}) => {
  return apiRequest(`/documents?${toQueryString(options)}`);
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

export const fetchDocumentTimeline = async (documentId) => {
  return apiRequest(
    `/documents/${encodeURIComponent(documentId)}/timeline`,
  );
};

export const fetchDocumentGraph = async (documentId) => {
  return apiRequest(`/documents/${encodeURIComponent(documentId)}/graph`);
};

export const sendCrossDocumentChat = async (
  message,
  documentIds,
  onChunk,
  onComplete,
  onError,
) => {
  const token = getAuthToken();
  if (!token) {
    onError(new Error("No authentication token found. Please login."));
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/documents/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": token,
      },
      body: JSON.stringify({ message, documentIds }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Request failed with ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";
    let sources = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const event of events) {
        if (!event.startsWith("data: ")) continue;
        const raw = event.slice(6);
        if (raw === "[DONE]") continue;
        const parsed = JSON.parse(raw);
        if (parsed.type === "meta") sources = parsed.sources || [];
        if (parsed.type === "content") {
          fullResponse += parsed.content;
          onChunk(parsed.content);
        }
        if (parsed.type === "error") throw new Error(parsed.error);
      }
    }
    onComplete({ response: fullResponse, sources });
  } catch (error) {
    onError(error);
  }
};

export const processDocumentResearch = async (
  documentType,
  documentId,
) => {
  return apiRequest("/document-chat/process", {
    method: "POST",
    body: JSON.stringify({ documentType, documentId }),
  });
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
  message,
  documentType,
  documentId,
  onChunk,
  onComplete,
  onError,
) => {
  const token = getAuthToken();
  if (!token) {
    onError(new Error("No authentication token found. Please login."));
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/document-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": token,
      },
      body: JSON.stringify({ message, documentType, documentId }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(
        payload.error ||
          payload.message ||
          `Request failed with status ${response.status}`,
      );
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sources = [];
    let fullResponse = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const event of events) {
        if (!event.startsWith("data: ")) continue;
        const raw = event.slice(6);
        if (raw === "[DONE]") continue;
        const parsed = JSON.parse(raw);
        if (parsed.type === "meta") sources = parsed.sources || [];
        if (parsed.type === "content") {
          fullResponse += parsed.content;
          onChunk(parsed.content);
        }
        if (parsed.type === "error") throw new Error(parsed.error);
      }
    }
    onComplete({ response: fullResponse, sources });
  } catch (error) {
    onError(error);
  }
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

export const changePassword = async (currentPassword, newPassword) => {
  return apiRequest("/profile/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
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
    const data = await apiRequest('/auth/getuser', {
      method: 'POST',
    });
    return data;
  } catch (error) {
    console.error('Error fetching user details:', error);
    throw error;
  }
};
