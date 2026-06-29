

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


export const fetchBills = async (page = 1, limit = 10, search = '', status = '') => {
  try {
    let url = `/bills?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (status && status !== 'All') {
      url += `&status=${encodeURIComponent(status)}`;
    }
    const data = await apiRequest(url);
    return data;
  } catch (error) {
    console.error('Error fetching bills:', error);
    throw error;
  }
};


export const fetchBillStatuses = async () => {
  try {
    const data = await apiRequest('/bills/status');
    return data;
  } catch (error) {
    console.error('Error fetching bill statuses:', error);
    throw error;
  }
};


export const fetchRelatedBills = async (billId) => {
  try {
    const data = await apiRequest(`/bills/relatedBills?billId=${billId}`);
    return data;
  } catch (error) {
    console.error('Error fetching related bills:', error);
    throw error;
  }
};


export const fetchBillSummary = async (billUrl) => {
  try {
    const data = await apiRequest('/bill-summary', {
      method: 'POST',
      body: JSON.stringify({ billUrl }),
    });
    return data;
  } catch (error) {
    console.error('Error fetching bill summary:', error);
    throw error;
  }
};


export const processBill = async (billId, pdfUrl, title) => {
  try {
    const data = await apiRequest('/process-bill', {
      method: 'POST',
      body: JSON.stringify({ billId, pdfUrl, title }),
    });
    return data;
  } catch (error) {
    console.error('Error processing bill:', error);
    throw error;
  }
};


export const getBillSummary = async (billId) => {
  try {
    const data = await apiRequest(`/bill-summary?billId=${billId}`);
    return data;
  } catch (error) {
    console.error('Error getting bill summary:', error);
    throw error;
  }
};


export const sendChatMessageStream = async (message, billId, onChunk, onComplete, onError) => {
  const token = getAuthToken();
  if (!token) {
    onError(new Error('No authentication token found. Please login.'));
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'auth-token': token,
      },
      body: JSON.stringify({ message, billId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sources = [];
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'meta') {
              sources = parsed.sources;
            } else if (parsed.type === 'content') {
              fullResponse += parsed.content;
              onChunk(parsed.content);
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }

    onComplete({ response: fullResponse, sources });
  } catch (error) {
    console.error('Error sending chat message:', error);
    onError(error);
  }
};

export const sendChatMessage = sendChatMessageStream;





export const getOrCreateBillChat = async (billId, title, status, pdfUrl, summary) => {
  try {
    const data = await apiRequest('/bill-chats/get-or-create', {
      method: 'POST',
      body: JSON.stringify({ billId, title, status, pdfUrl, summary }),
    });
    return data;
  } catch (error) {
    console.error('Error getting or creating bill chat:', error);
    throw error;
  }
};


export const getBillChat = async (billId) => {
  try {
    const data = await apiRequest(`/bill-chats/${billId}`);
    return data;
  } catch (error) {
    console.error('Error getting bill chat:', error);
    throw error;
  }
};


export const addMessageToBillChat = async (billId, messageData) => {
  try {
    const data = await apiRequest(`/bill-chats/${billId}/message`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
    return data;
  } catch (error) {
    console.error('Error adding message to bill chat:', error);
    throw error;
  }
};


export const updateBillChatSummary = async (billId, summary) => {
  try {
    const data = await apiRequest(`/bill-chats/${billId}/summary`, {
      method: 'PATCH',
      body: JSON.stringify({ summary }),
    });
    return data;
  } catch (error) {
    console.error('Error updating bill chat summary:', error);
    throw error;
  }
};


export const getUserRecentChats = async (limit = 10) => {
  try {
    const data = await apiRequest(`/bill-chats/user/recent?limit=${limit}`);
    return data;
  } catch (error) {
    console.error('Error getting recent chats:', error);
    throw error;
  }
};


export const clearBillChatMessages = async (billId) => {
  try {
    const data = await apiRequest(`/bill-chats/${billId}/messages`, {
      method: 'DELETE',
    });
    return data;
  } catch (error) {
    console.error('Error clearing bill chat messages:', error);
    throw error;
  }
};


export const deleteBillChat = async (billId) => {
  try {
    const data = await apiRequest(`/bill-chats/${billId}`, {
      method: 'DELETE',
    });
    return data;
  } catch (error) {
    console.error('Error deleting bill chat:', error);
    throw error;
  }
};




export const fetchActs = async (page = 1, limit = 10, search = '', year = '') => {
  try {
    let url = `/acts?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (year && year !== 'All') {
      url += `&year=${encodeURIComponent(year)}`;
    }
    const data = await apiRequest(url);
    return data;
  } catch (error) {
    console.error('Error fetching acts:', error);
    throw error;
  }
};


export const fetchActYears = async () => {
  try {
    const data = await apiRequest('/acts/years');
    return data;
  } catch (error) {
    console.error('Error fetching act years:', error);
    throw error;
  }
};


export const processAct = async (actId, pdfUrl, title) => {
  try {
    const data = await apiRequest('/process-act', {
      method: 'POST',
      body: JSON.stringify({ actId, pdfUrl, title }),
    });
    return data;
  } catch (error) {
    console.error('Error processing act:', error);
    throw error;
  }
};


export const getActSummary = async (actId) => {
  try {
    const data = await apiRequest(`/act-summary?actId=${actId}`);
    return data;
  } catch (error) {
    console.error('Error getting act summary:', error);
    throw error;
  }
};


export const sendActChatMessageStream = async (message, actId, onChunk, onComplete, onError) => {
  const token = getAuthToken();
  if (!token) {
    onError(new Error('No authentication token found. Please login.'));
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/act-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'auth-token': token,
      },
      body: JSON.stringify({ message, actId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sources = [];
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'meta') {
              sources = parsed.sources;
            } else if (parsed.type === 'content') {
              fullResponse += parsed.content;
              onChunk(parsed.content);
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }

    onComplete({ response: fullResponse, sources });
  } catch (error) {
    console.error('Error sending act chat message:', error);
    onError(error);
  }
};

export const sendActChatMessage = sendActChatMessageStream;





export const getOrCreateActChat = async (actId, title, status, pdfUrl, summary) => {
  try {
    const data = await apiRequest('/act-chats/get-or-create', {
      method: 'POST',
      body: JSON.stringify({ actId, title, status, pdfUrl, summary }),
    });
    return data;
  } catch (error) {
    console.error('Error getting or creating act chat:', error);
    throw error;
  }
};


export const getActChat = async (actId) => {
  try {
    const data = await apiRequest(`/act-chats/${actId}`);
    return data;
  } catch (error) {
    console.error('Error getting act chat:', error);
    throw error;
  }
};


export const addMessageToActChat = async (actId, messageData) => {
  try {
    const data = await apiRequest(`/act-chats/${actId}/message`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
    return data;
  } catch (error) {
    console.error('Error adding message to act chat:', error);
    throw error;
  }
};


export const updateActChatSummary = async (actId, summary) => {
  try {
    const data = await apiRequest(`/act-chats/${actId}/summary`, {
      method: 'PATCH',
      body: JSON.stringify({ summary }),
    });
    return data;
  } catch (error) {
    console.error('Error updating act chat summary:', error);
    throw error;
  }
};


export const getUserRecentActChats = async (limit = 10) => {
  try {
    const data = await apiRequest(`/act-chats/user/recent?limit=${limit}`);
    return data;
  } catch (error) {
    console.error('Error getting recent act chats:', error);
    throw error;
  }
};


export const clearActChatMessages = async (actId) => {
  try {
    const data = await apiRequest(`/act-chats/${actId}/messages`, {
      method: 'DELETE',
    });
    return data;
  } catch (error) {
    console.error('Error clearing act chat messages:', error);
    throw error;
  }
};


export const deleteActChat = async (actId) => {
  try {
    const data = await apiRequest(`/act-chats/${actId}`, {
      method: 'DELETE',
    });
    return data;
  } catch (error) {
    console.error('Error deleting act chat:', error);
    throw error;
  }
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

export const fetchEGazettes = async (options = {}) => {
  return apiRequest(`/egazettes?${toQueryString(options)}`);
};

export const fetchEGazette = async (gazetteId) => {
  return apiRequest(`/egazettes/${encodeURIComponent(gazetteId)}`);
};

export const processEGazette = async (gazetteId) => {
  return apiRequest("/process-egazette", {
    method: "POST",
    body: JSON.stringify({ gazetteId }),
  });
};

export const getEGazetteSummary = async (gazetteId) => {
  return apiRequest(
    `/egazette-summary?gazetteId=${encodeURIComponent(gazetteId)}`,
  );
};

export const getOrCreateEGazetteChat = async (gazette) => {
  return apiRequest("/egazette-chat/session", {
    method: "POST",
    body: JSON.stringify({
      gazetteId: gazette.id,
      summary: gazette.summary,
    }),
  });
};

export const getEGazetteChatHistory = async (gazetteId) => {
  return apiRequest(
    `/egazette-chat/history?gazetteId=${encodeURIComponent(gazetteId)}`,
  );
};

export const addEGazetteChatMessage = async (gazetteId, message) => {
  return apiRequest("/egazette-chat/message", {
    method: "POST",
    body: JSON.stringify({ gazetteId, ...message }),
  });
};

export const updateEGazetteChatSummary = async (gazetteId, summary) => {
  return apiRequest("/egazette-chat/summary", {
    method: "PATCH",
    body: JSON.stringify({ gazetteId, summary }),
  });
};

export const clearEGazetteChat = async (gazetteId) => {
  return apiRequest(
    `/egazette-chat/history?gazetteId=${encodeURIComponent(gazetteId)}`,
    { method: "DELETE" },
  );
};

export const sendEGazetteChatMessage = async (
  message,
  gazetteId,
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
    const response = await fetch(`${API_BASE_URL}/egazette-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": token,
      },
      body: JSON.stringify({ message, gazetteId }),
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

export const getDocumentResearch = async (documentType, documentId) => {
  return apiRequest(
    `/document-chat/document/${encodeURIComponent(
      documentType,
    )}/${encodeURIComponent(documentId)}`,
  );
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
