export const comparisonHrefForDocuments = (documents = []) => {
  const ids = [
    ...new Set(documents.map((document) => String(document?.id || ""))),
  ]
    .filter(Boolean)
    .slice(0, 5);
  return ids.length >= 2
    ? `/app/compare?${new URLSearchParams({ ids: ids.join(",") }).toString()}`
    : null;
};
