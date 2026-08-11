// Vector namespace occupancy check.
//
// The vector namespace is derived from the embedding model
// (`${EMBEDDING_MODEL}-${DIM}-v1`), so changing embedding provider
// silently changes which namespace the application reads. Nothing fails
// when the new namespace is empty: Pinecone returns zero matches,
// retrieval quietly falls back to Postgres lexical search, and the
// product looks like it is merely giving weaker answers.
//
// That is not hypothetical. A live census found 12,721 vectors spread
// across five namespaces, while the API was configured to read
// `gemini-embedding-001-768-v1`, which held 132 of them in one index and
// none at all in the other — roughly 99% of the corpus unreachable, with
// no error anywhere.
//
// Embeddings from different models are NOT interchangeable even at equal
// dimensions; they occupy different vector spaces. So the fix is not to
// merge namespaces, it is to make occupancy visible: report how many
// vectors the active namespace actually holds, so a provider switch can
// never quietly orphan the corpus again.

// Below this, retrieval is effectively running on the lexical fallback
// even though vector search is nominally "available".
const LOW_OCCUPANCY_RATIO = 0.5;

const summarizeNamespaces = (namespaces = {}, activeNamespace) => {
  const entries = Object.entries(namespaces).map(([name, value]) => ({
    namespace: name || "(default)",
    records: Number(value?.recordCount ?? value?.vectorCount ?? 0),
  }));
  const total = entries.reduce((sum, entry) => sum + entry.records, 0);
  const active = entries.find((entry) => entry.namespace === activeNamespace);
  const activeRecords = active ? active.records : 0;

  let state = "ok";
  let message = null;
  if (total === 0) {
    state = "empty_index";
    message = "The index contains no vectors at all.";
  } else if (activeRecords === 0) {
    state = "orphaned";
    message =
      `The active namespace "${activeNamespace}" contains no vectors, but the ` +
      `index holds ${total}. Vector retrieval cannot return anything and will ` +
      `fall back to lexical search. This usually means the embedding provider ` +
      `or model changed without re-embedding.`;
  } else if (activeRecords / total < LOW_OCCUPANCY_RATIO) {
    state = "low_occupancy";
    message =
      `The active namespace "${activeNamespace}" holds ${activeRecords} of ` +
      `${total} vectors in this index. Most of the corpus is not reachable by ` +
      `vector retrieval under the current embedding configuration.`;
  }

  return {
    activeNamespace,
    activeRecords,
    totalRecords: total,
    state,
    message,
    // Sorted largest-first so the likely intended namespace is obvious
    // when diagnosing a misconfiguration.
    namespaces: entries.sort((a, b) => b.records - a.records),
  };
};

// `indexes` is [{ name, index }]. Never throws: a namespace check must
// never be able to take down the health endpoint.
const checkVectorNamespaces = async (indexes, activeNamespace) => {
  const results = {};
  for (const { name, index } of indexes) {
    try {
      const stats = await index.describeIndexStats();
      results[name] = summarizeNamespaces(stats?.namespaces || {}, activeNamespace);
    } catch (error) {
      results[name] = {
        activeNamespace,
        state: "unavailable",
        message: `Could not read index stats: ${String(error.message || "").slice(0, 160)}`,
      };
    }
  }
  const degraded = Object.values(results).filter((r) =>
    ["orphaned", "low_occupancy", "empty_index"].includes(r.state),
  );
  return {
    healthy: degraded.length === 0,
    activeNamespace,
    indexes: results,
  };
};

module.exports = {
  LOW_OCCUPANCY_RATIO,
  checkVectorNamespaces,
  summarizeNamespaces,
};
