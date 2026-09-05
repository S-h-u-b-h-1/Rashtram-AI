"use client";

import {
  Check,
  Copy,
  FileDown,
  Loader2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationCard } from "./CitationCard";
import { formatMessageTime } from "@/lib/research-workspace.mjs";

function ChatMessageComponent({ message, onDownloadPdf, onFeedback }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isUser = message.sender === "user";
  const messageLength = String(message.text || "").trim().length;
  const canDownloadPdf = !isUser
    && !message.isStreaming
    && !message.isError
    && (messageLength >= 180 || Boolean(message.metadata?.exportMessageId))
    && Boolean(message._id || message.id || message.metadata?.exportMessageId);

  const copy = async () => {
    await navigator.clipboard.writeText(message.text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  };

  const downloadPdf = async () => {
    if (!onDownloadPdf || downloading) return;
    setDownloading(true);
    try {
      await onDownloadPdf(message);
    } catch {
      // The parent workspace presents the actionable download error.
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article
      id={message._id || message.id ? `research-message-${message._id || message.id}` : undefined}
      className={
        isUser
          ? "ml-auto max-w-[92%] rounded-2xl bg-[#eee0dc] px-4 py-3 text-[#29312d] sm:max-w-[80%]"
          : "w-full min-w-0 max-w-full px-1 py-5 text-[#29312d] sm:px-2"
      }
    >
      <div
        className={`chat-markdown min-h-6 ${isUser ? "user-message" : ""}`}
        aria-live={message.isStreaming ? "polite" : undefined}
        aria-busy={message.isStreaming || undefined}
      >
        {message.metadata?.workflowTitle && (
          <p
            className={`mb-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
              isUser
                ? "bg-white/60 text-[#8f1d2c]"
                : "bg-[#eee0dc] text-[#8f1d2c]"
            }`}
          >
            Workflow · {message.metadata.workflowTitle}
          </p>
        )}
        {message.isStreaming && !message.text ? (
          <div className="flex items-center gap-2 text-sm text-[#706a61]">
            <Loader2 className="h-4 w-4 animate-spin text-[#a85a52]" />
            <span>Preparing grounded response…</span>
            <span className="inline-flex gap-1" aria-hidden="true">
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#a85a52]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#a85a52] [animation-delay:120ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#a85a52] [animation-delay:240ms]" />
            </span>
          </div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.text || ""}
          </ReactMarkdown>
        )}
      </div>
      {message.isStreaming && message.text && (
        <span
          className="mt-2 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-[#a85a52]"
          aria-hidden="true"
        />
      )}
      {!isUser && message.sources?.length > 0 && (
        <details open className="mt-4 border-t border-[#8f1d2c]/8 pt-3">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[#874047]">
            {message.sources.length} cited passages
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {message.sources.map((source, index) => (
              <CitationCard
                key={`${source.chunkIndex}-${source.passage}-${index}`}
                source={source}
                index={index}
              />
            ))}
          </div>
        </details>
      )}
      <footer
        className={`mt-3 flex items-center gap-2 text-[10px] ${
          isUser ? "text-[#625b53]" : "text-[#706a61]"
        }`}
      >
        <span>{formatMessageTime(message.timestamp)}</span>
        {!message.isStreaming && (
          <button
            type="button"
            onClick={copy}
            aria-label="Copy response"
            className="ml-auto grid h-11 w-11 place-items-center rounded-md hover:bg-black/5"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {canDownloadPdf && (
          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading}
            aria-label="Download this answer as a cited PDF"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-semibold text-[#874047] hover:bg-[#8f1d2c]/8 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            Download PDF
          </button>
        )}
        {!isUser &&
          !message.isStreaming &&
          (message._id || message.id) && (
          <>
            <button
              type="button"
              onClick={() => onFeedback(message, 1).catch(() => {})}
              aria-label="Helpful response"
              className="grid h-11 w-11 place-items-center rounded-md hover:bg-black/5"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onFeedback(message, -1).catch(() => {})}
              aria-label="Unhelpful response"
              className="grid h-11 w-11 place-items-center rounded-md hover:bg-black/5"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </>
          )}
      </footer>
    </article>
  );
}

export const ChatMessage = memo(
  ChatMessageComponent,
  (previous, next) => previous.message === next.message,
);
