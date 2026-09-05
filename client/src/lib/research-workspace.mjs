// Presentation and navigation only. Capability decisions stay with the API.
export const PRIMARY_NAVIGATION = [
  { key: "dashboard", label: "New Research", href: "/app" },
  { key: "documents", label: "Library", href: "/app/library" },
  { key: "research", label: "My Research", href: "/app/research" },
];

export const uniqueIds = (values, limit = 20) => [...new Set(
  (Array.isArray(values) ? values : String(values || "").split(","))
    .map((value) => String(value).trim())
    .filter((value) => /^[a-zA-Z0-9_-]+$/.test(value)),
)].slice(0, limit);

export function workspaceHref({ documentIds = [], sourceIds = [], question = "" } = {}) {
  const ids = uniqueIds(documentIds, 5);
  const sources = uniqueIds(sourceIds);
  if (!ids.length && !sources.length) return "/app";
  const params = new URLSearchParams();
  if (sources.length) params.set("sources", sources.join(","));
  if (question.trim()) params.set("q", question.trim().slice(0, 1600));
  if (ids.length === 1) {
    return `/app/document/${encodeURIComponent(ids[0])}${params.size ? `?${params}` : ""}`;
  }
  if (ids.length) params.set("ids", ids.join(","));
  return `/app/multi-document-chat?${params}`;
}

export function resumeChatHref(chat = {}) {
  if (chat.documentId) return `/app/document/${encodeURIComponent(chat.documentId)}`;
  // Multi-source history has a separate durable store, even with one document.
  const ids = uniqueIds(chat.documentIds, 5);
  const sources = uniqueIds(chat.historySourceIds?.length ? chat.historySourceIds : chat.sourceIds);
  if (ids.length || sources.length) {
    const params = new URLSearchParams();
    if (ids.length) params.set('ids', ids.join(','));
    if (sources.length) params.set('sources', sources.join(','));
    if (chat.comparisonId) params.set('comparison', String(chat.comparisonId));
    return `/app/multi-document-chat?${params}`;
  }
  return null;
}

export const LIBRARY_FILTER_KEYS = ['type', 'status', 'year', 'ministry', 'authority', 'category', 'jurisdiction', 'source', 'sourceType', 'language', 'state', 'hasPdf', 'researchReady', 'comparisonReady', 'publicationFrom', 'publicationTo', 'scope', 'jurisdictionLevel'];
export function savedSearchHref(search = {}) {
  const params = new URLSearchParams({ q: search.query || '' });
  for (const key of LIBRARY_FILTER_KEYS) {
    const value = search.filters?.[key];
    if (value !== undefined && value !== null) params.set(key, String(value).slice(0, 200));
  }
  return `/app/library?${params}`;
}

export function formatMessageTime(value) {
  if (!value) return "";
  // Legacy messages used local clock text. Display it without inventing a date.
  if (typeof value === "string" && /^\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?$/i.test(value.trim())) return value.trim();
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
}

export function selectedPersonalSources(sources = [], ids = []) {
  const selected = new Set(uniqueIds(ids));
  return sources.filter((source) => selected.has(String(source.id)) && source.status === "ready");
}

export function restoreSourceIds(messages = [], availableSources = []) {
  const lastScopedMessage = [...messages].reverse().find((message) => Array.isArray(message.metadata?.sourceIds));
  return selectedPersonalSources(availableSources, lastScopedMessage?.metadata?.sourceIds || []).map((source) => String(source.id));
}

export function sourceCount(catalogueSources = [], personalSources = [], selectedIds = []) {
  return uniqueIds(catalogueSources.filter((source) => source.researchReady ?? source.capabilities?.chatReady).map((source) => source.id)).length
    + selectedPersonalSources(personalSources, selectedIds).length;
}
