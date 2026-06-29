export const buildResearchHref = (document) => {
  const id = document.documentId || document.id;
  return id ? `/app/document/${id}` : null;
};

export const formatDate = (value, fallback = "Date unavailable") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const formatRelativeTime = (value) => {
  if (!value) return "No refresh recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No refresh recorded";
  const difference = Date.now() - date.getTime();
  const hours = Math.floor(difference / 3_600_000);
  if (hours < 1) return "Less than an hour ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const humanize = (value) =>
  String(value || "Update")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
