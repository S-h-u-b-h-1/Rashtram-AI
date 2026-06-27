

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
    throw new Error(error.message || `Request failed with status ${response.status}`);
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


export const getDashboardData = async () => {
  try {
    const data = await apiRequest('/dashboard');
    return data;
  } catch (error) {
    throw error;
  }
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
