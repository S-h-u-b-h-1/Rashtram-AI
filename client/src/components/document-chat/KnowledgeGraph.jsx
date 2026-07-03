"use client";

import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Minus,
  Network,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { humanize } from "@/lib/document-links";

const NODE_COLORS = {
  act: "#8f1d2c",
  bill: "#a95f3b",
  policy: "#6f5137",
  gazette: "#70415f",
  notification: "#70415f",
  rule: "#42605a",
  regulation: "#42605a",
  circular: "#78652c",
  report: "#415b75",
  ministry: "#a87938",
  authority: "#a87938",
  jurisdiction: "#77716a",
};

const forceLayout = (graph, width = 720, height = 430) => {
  const nodes = (graph?.nodes || []).slice(0, 80).map((node, index) => {
    const angle = (index / Math.max((graph.nodes || []).length, 1)) * Math.PI * 2;
    const root = node.id === graph.rootId;
    return {
      ...node,
      x: root ? width / 2 : width / 2 + Math.cos(angle) * 150,
      y: root ? height / 2 : height / 2 + Math.sin(angle) * 120,
      root,
    };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = (graph?.edges || []).filter(
    (edge) => byId.has(edge.from) && byId.has(edge.to),
  );
  for (let iteration = 0; iteration < 70; iteration += 1) {
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < nodes.length;
        rightIndex += 1
      ) {
        const left = nodes[leftIndex];
        const right = nodes[rightIndex];
        const dx = right.x - left.x || 0.1;
        const dy = right.y - left.y || 0.1;
        const distanceSquared = Math.max(dx * dx + dy * dy, 100);
        const force = 850 / distanceSquared;
        const distance = Math.sqrt(distanceSquared);
        if (!left.root) {
          left.x -= (dx / distance) * force;
          left.y -= (dy / distance) * force;
        }
        if (!right.root) {
          right.x += (dx / distance) * force;
          right.y += (dy / distance) * force;
        }
      }
    }
    for (const edge of edges) {
      const source = byId.get(edge.from);
      const target = byId.get(edge.to);
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const desired = source.root || target.root ? 125 : 95;
      const force = (distance - desired) * 0.035;
      if (!source.root) {
        source.x += (dx / distance) * force;
        source.y += (dy / distance) * force;
      }
      if (!target.root) {
        target.x -= (dx / distance) * force;
        target.y -= (dy / distance) * force;
      }
    }
    for (const node of nodes) {
      if (node.root) continue;
      node.x = Math.min(Math.max(node.x, 35), width - 35);
      node.y = Math.min(Math.max(node.y, 35), height - 35);
    }
  }
  return { nodes, edges, byId, width, height };
};

export function KnowledgeGraph({ graph, compact = true, highlightedPath = [] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [zoom, setZoom] = useState(compact ? 0.82 : 1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState("");
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const drag = useRef(null);
  const layout = useMemo(() => forceLayout(graph), [graph]);
  const pathEdgeIds = useMemo(
    () => new Set(highlightedPath.map((edge) => String(edge.id))),
    [highlightedPath],
  );
  const searchValue = search.trim().toLowerCase();

  if (!graph?.nodes?.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#8f1d2c]/8 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#8f1d2c]/8 p-4">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-[#8f1d2c]" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#514d46]">
              Related legal network
            </h3>
            <p className="mt-0.5 text-[10px] text-[#81796e]">
              {layout.nodes.length} nodes · {layout.edges.length} relationships
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!compact && (
            <>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(value + 0.15, 2))}
                className="rounded-lg bg-[#f7f2eb] p-2"
                aria-label="Zoom in"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(value - 0.15, 0.45))}
                className="rounded-lg bg-[#f7f2eb] p-2"
                aria-label="Zoom out"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="rounded-lg bg-[#f7f2eb] p-2"
            aria-label={collapsed ? "Expand graph" : "Collapse graph"}
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {!compact && (
            <label className="relative m-4 block max-w-sm">
              <span className="sr-only">Search graph nodes</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#81796e]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Highlight a document, ministry or state"
                className="h-9 w-full rounded-xl border border-[#8f1d2c]/10 bg-[#fffdf8] pl-9 pr-3 text-xs outline-none focus:border-[#8f1d2c]/35"
              />
            </label>
          )}
          <div
            className={compact ? "h-64" : "h-[560px]"}
            onPointerDown={(event) => {
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                pan,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              setPan({
                x: drag.current.pan.x + event.clientX - drag.current.x,
                y: drag.current.pan.y + event.clientY - drag.current.y,
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="h-full w-full cursor-grab bg-[#fffdf8] active:cursor-grabbing"
              role="img"
              aria-label="Interactive government document relationship graph"
            >
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                {layout.edges.map((edge) => {
                  const source = layout.byId.get(edge.from);
                  const target = layout.byId.get(edge.to);
                  const highlighted = pathEdgeIds.has(String(edge.id));
                  return (
                    <g key={`${edge.id}-${edge.from}-${edge.to}`}>
                      <line
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={highlighted ? "#8f1d2c" : "#c9b8ad"}
                        strokeWidth={highlighted ? 4 : 1.4}
                        opacity={0.85}
                        onPointerEnter={() => setHoveredEdge(edge)}
                        onPointerLeave={() => setHoveredEdge(null)}
                      />
                    </g>
                  );
                })}
                {layout.nodes.map((node) => {
                  const matches =
                    !searchValue ||
                    node.label?.toLowerCase().includes(searchValue);
                  const radius = node.root ? 17 : node.entity ? 9 : 12;
                  const nodeContent = (
                    <>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={matches ? radius : radius - 3}
                        fill={NODE_COLORS[node.kind] || "#6b625b"}
                        opacity={matches ? 1 : 0.22}
                        stroke={node.root ? "#fff" : "transparent"}
                        strokeWidth={node.root ? 4 : 0}
                      />
                      <text
                        x={node.x}
                        y={node.y + radius + 13}
                        textAnchor="middle"
                        className="pointer-events-none fill-[#514d46] text-[9px]"
                        opacity={matches ? 1 : 0.25}
                      >
                        {String(node.label || "").slice(0, 34)}
                      </text>
                      <title>
                        {node.label} · {humanize(node.kind)}
                      </title>
                    </>
                  );
                  return node.document ? (
                    <Link
                      key={node.id}
                      href={`/app/document/${node.document.id}`}
                      aria-label={`Research ${node.label}`}
                    >
                      {nodeContent}
                    </Link>
                  ) : (
                    <g key={node.id}>{nodeContent}</g>
                  );
                })}
              </g>
            </svg>
          </div>
          {hoveredEdge && (
            <div className="border-t border-[#8f1d2c]/8 bg-[#f7f2eb] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8f1d2c]">
                {humanize(hoveredEdge.type)}
                {hoveredEdge.confidence != null
                  ? ` · ${Math.round(hoveredEdge.confidence * 100)}% confidence`
                  : ""}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#706a61]">
                {hoveredEdge.explanation ||
                  "Verified catalogue relationship; no further explanation is stored."}
              </p>
            </div>
          )}
          {compact && graph.currentDocument?.id && (
            <Link
              href={`/app/graph/${graph.currentDocument.id}`}
              className="flex items-center justify-between border-t border-[#8f1d2c]/8 px-4 py-3 text-xs font-semibold text-[#8f1d2c]"
            >
              Explore full network
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </>
      )}
    </section>
  );
}
