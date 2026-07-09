"use client";

import {
  GitCompareArrows,
  Loader2,
  Route,
  Save,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KnowledgeGraph } from "@/components/document-chat/KnowledgeGraph";
import { useComparison } from "@/context/ComparisonContext";
import {
  fetchDocumentGraph,
  findKnowledgeGraphPath,
  saveKnowledgeGraphPath,
  searchKnowledgeGraph,
  trackActivity,
} from "@/lib/api";

export function GraphExplorer({ documentId }) {
  const [graph, setGraph] = useState(null);
  const [path, setPath] = useState(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { addDocument } = useComparison();

  useEffect(() => {
    const controller = new AbortController();
    fetchDocumentGraph(documentId, { depth: 2, limit: 140 })
      .then(({ graph: loadedGraph }) => {
        if (controller.signal.aborted) return;
        setGraph(loadedGraph);
        trackActivity({
          event_type: "graph_viewed",
          entity_type: "knowledge_graph",
          entity_id: String(documentId),
          document_id: documentId,
          page_path: `/app/graph/${documentId}`,
          metadata_json: {
            nodeCount: loadedGraph.nodes?.length || 0,
            edgeCount: loadedGraph.edges?.length || 0,
          },
        });
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [documentId]);

  const search = async (event) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError("");
    try {
      const result = await searchKnowledgeGraph(query, { limit: 12 });
      setMatches(result.nodes || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSearching(false);
    }
  };

  const highlightPath = async (targetDocumentId) => {
    setSearching(true);
    setError("");
    try {
      const result = await findKnowledgeGraphPath(
        documentId,
        targetDocumentId,
      );
      setPath(result.path);
      if (!result.path.found) {
        setNotice("No supported relationship path was found within six steps.");
      } else {
        setNotice(
          `Highlighted ${result.path.length} relationship${
            result.path.length === 1 ? "" : "s"
          }.`,
        );
        trackActivity({
          event_type: "graph_path_searched",
          entity_type: "graph_path",
          entity_id: `${documentId}:${targetDocumentId}`,
          document_id: documentId,
          page_path: `/app/graph/${documentId}`,
          metadata_json: {
            targetDocumentId,
            length: result.path.length,
          },
        });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSearching(false);
    }
  };

  const savePath = async () => {
    if (!path?.found || !path.nodes?.length) return;
    const target = path.nodes[path.nodes.length - 1]?.document;
    try {
      await saveKnowledgeGraphPath({
        sourceDocumentId: documentId,
        targetDocumentId: target.id,
        title: `${graph.currentDocument.title} → ${target.title}`,
      });
      setNotice("Relationship path saved to your research profile.");
      trackActivity({
        event_type: "graph_path_saved",
        entity_type: "graph_path",
        entity_id: `${documentId}:${target.id}`,
        document_id: documentId,
        page_path: `/app/graph/${documentId}`,
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (loading) {
    return (
      <div className="surface-card grid min-h-[520px] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#8f1d2c]" />
          <p className="mt-3 text-sm text-[#706a61]">
            Loading the government knowledge network…
          </p>
        </div>
      </div>
    );
  }

  if (error && !graph) {
    return (
      <section className="surface-card p-8 text-center" role="alert">
        <h1 className="font-serif text-2xl text-[#8f1d2c]">
          Knowledge network unavailable
        </h1>
        <p className="mt-2 text-sm text-[#706a61]">{error}</p>
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-5 pb-5">
      <section className="surface-card overflow-hidden">
        <div className="bg-[#8f1d2c] p-6 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
            Government Knowledge Network
          </p>
          <h1 className="mt-2 max-w-4xl font-serif text-3xl">
            {graph.currentDocument.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            Explore explainable links across legislation, delegated rules,
            notifications, policies, reports, ministries and jurisdictions.
          </p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <KnowledgeGraph
          graph={graph}
          compact={false}
          highlightedPath={path?.edges || []}
        />

        <aside className="space-y-4">
          <section className="surface-card p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[#8f1d2c]" />
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[#514d46]">
                Find a relationship path
              </h2>
            </div>
            <form onSubmit={search} className="mt-3 flex gap-2">
              <label className="sr-only" htmlFor="graph-search">
                Search government documents
              </label>
              <input
                id="graph-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Act, policy, ministry…"
                className="min-w-0 flex-1 rounded-xl border border-[#8f1d2c]/10 px-3 py-2 text-xs outline-none focus:border-[#8f1d2c]/35"
              />
              <button
                type="submit"
                disabled={searching || query.trim().length < 2}
                className="rounded-xl bg-[#8f1d2c] px-3 text-white disabled:opacity-45"
                aria-label="Search graph"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </button>
            </form>
            <div className="mt-3 space-y-2">
              {matches.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => highlightPath(node.document.id)}
                  className="w-full rounded-xl bg-[#f7f2eb] p-3 text-left"
                >
                  <span className="block text-xs font-semibold text-[#29312d]">
                    {node.label}
                  </span>
                  <span className="mt-1 block text-[9px] uppercase tracking-[0.1em] text-[#81796e]">
                    {node.document.documentType} · {node.relationshipCount} links
                  </span>
                </button>
              ))}
            </div>
          </section>

          {path?.found && (
            <section className="surface-card p-4">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-[#8f1d2c]" />
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[#514d46]">
                  Highlighted path
                </h2>
              </div>
              <ol className="mt-3 space-y-2">
                {path.nodes.map((node, index) => (
                  <li key={node.id} className="rounded-xl bg-[#f7f2eb] p-3">
                    <Link
                      href={`/app/document/${node.document.id}`}
                      onClick={() =>
                        trackActivity({
                          event_type: "graph_node_opened",
                          entity_type: "document",
                          entity_id: node.document.id,
                          document_id: node.document.id,
                          page_path: `/app/graph/${documentId}`,
                        })
                      }
                      className="text-xs font-semibold text-[#29312d]"
                    >
                      {index + 1}. {node.label}
                    </Link>
                    {path.edges[index] && (
                      <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-[#8f1d2c]">
                        {path.edges[index].label}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={savePath}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#8f1d2c] px-3 py-2 text-xs font-semibold text-white"
              >
                <Save className="h-3.5 w-3.5" />
                Save path
              </button>
            </section>
          )}

          <section className="surface-card p-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[#514d46]">
              Research actions
            </h2>
            <div className="mt-3 grid gap-2">
              <Link
                href={`/app/document/${documentId}`}
                className="rounded-xl bg-[#f7f2eb] px-3 py-2 text-xs font-semibold text-[#8f1d2c]"
              >
                Open document research
              </Link>
              <button
                type="button"
                onClick={() => {
                  const result = addDocument(graph.currentDocument);
                  setNotice(
                    result.ok
                      ? "Document added to comparison."
                      : result.reason,
                  );
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#f7f2eb] px-3 py-2 text-left text-xs font-semibold text-[#8f1d2c]"
              >
                <GitCompareArrows className="h-3.5 w-3.5" />
                Add center document to compare
              </button>
            </div>
          </section>
        </aside>
      </div>

      {(notice || error) && (
        <p
          role={error ? "alert" : "status"}
          className="surface-card px-4 py-3 text-sm text-[#706a61]"
        >
          {error || notice}
        </p>
      )}
    </div>
  );
}
