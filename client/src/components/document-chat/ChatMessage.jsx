"use client";

import { Check, Copy, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationCard } from "./CitationCard";

function ChatMessageComponent({ message, onFeedback }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.sender === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <article
      className={
        isUser
          ? "ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#8f1d2c] px-5 py-4 text-white sm:max-w-[78%]"
          : "max-w-[94%] rounded-2xl rounded-bl-md border border-[#8f1d2c]/8 bg-[#f6f2eb] px-5 py-4 text-[#29312d] shadow-sm sm:max-w-[86%]"
      }
    >
      <div
        className={`chat-markdown min-h-6 ${isUser ? "user-message" : ""}`}
        aria-live={message.isStreaming ? "polite" : undefined}
        aria-busy={message.isStreaming || undefined}
      >
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
        <details className="mt-4 border-t border-[#8f1d2c]/8 pt-3">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[#874047]">
            {message.sources.length} cited passages
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
          isUser ? "text-white/55" : "text-[#8a8277]"
        }`}
      >
        <span>{message.timestamp}</span>
        {!message.isStreaming && (
          <button
            type="button"
            onClick={copy}
            aria-label="Copy response"
            className="ml-auto rounded-md p-1 hover:bg-black/5"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
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
              className="rounded-md p-1 hover:bg-black/5"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onFeedback(message, -1).catch(() => {})}
              aria-label="Unhelpful response"
              className="rounded-md p-1 hover:bg-black/5"
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
