"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpenText,
  ExternalLink,
  FileDown,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  addEGazetteChatMessage,
  clearEGazetteChat,
  fetchEGazette,
  getEGazetteChatHistory,
  getEGazetteSummary,
  getOrCreateEGazetteChat,
  processEGazette,
  sendEGazetteChatMessage,
  trackActivity,
  updateEGazetteChatSummary,
} from "@/lib/api";
import { formatDate, humanize } from "@/lib/document-links";

const SUGGESTED_QUESTIONS = [
  "What is the operative effect of this notification?",
  "Which authorities and regulated persons are affected?",
  "What compliance dates, obligations, or penalties are stated?",
];

const timeLabel = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

function EGazetteChatWorkspace() {
  const params = useParams();
  const gazetteId = String(params.id);
  const [gazette, setGazette] = useState(null);
  const [summary, setSummary] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        setLoading(true);
        setError("");
        const detail = await fetchEGazette(gazetteId);
        if (cancelled) return;
        const document = detail.gazette;
        setGazette({
          ...document,
          recommendations: detail.recommendations || [],
        });
        trackActivity({
          event_type: "document_opened",
          entity_type: "gazette",
          entity_id: gazetteId,
          document_id: gazetteId,
          page_path: `/app/egazette-chat/${gazetteId}`,
          metadata_json: {
            documentType: document.notificationType || "gazette",
            category: document.gazetteType,
            ministry: document.ministry,
            jurisdiction: document.jurisdiction,
          },
        });

        const history = await getEGazetteChatHistory(gazetteId).catch(
          () => ({ chat: null }),
        );
        if (cancelled) return;
        if (history.chat?.messages?.length) {
          setMessages(history.chat.messages);
          setSummary(history.chat.summary || document.summary || "");
          await getOrCreateEGazetteChat({
            ...document,
            summary: history.chat.summary || document.summary,
          });
          return;
        }

        let generatedSummary = document.summary || "";
        if (document.pdfUrl) {
          setProcessing(true);
          const result = await processEGazette(gazetteId);
          generatedSummary = result.summary || generatedSummary;
          if (!generatedSummary) {
            const summaryResult = await getEGazetteSummary(gazetteId);
            generatedSummary = summaryResult.summary || "";
          }
        }
        if (cancelled) return;
        setSummary(generatedSummary);
        const session = await getOrCreateEGazetteChat({
          ...document,
          summary: generatedSummary,
        });
        const welcome = {
          text: document.pdfUrl
            ? `I've prepared **${document.title}** for evidence-grounded research. Ask about the notification, affected authorities, dates, obligations, or related legislation.`
            : `I can show the verified metadata for **${document.title}**, but its PDF is not currently available for grounded document chat.`,
          sender: "assistant",
          timestamp: timeLabel(),
        };
        if (!session.chat?.messages?.length) {
          await addEGazetteChatMessage(gazetteId, welcome);
        }
        setMessages([welcome]);
        if (generatedSummary) {
          await updateEGazetteChatSummary(gazetteId, generatedSummary);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message || "Unable to open this Gazette workspace.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setProcessing(false);
        }
      }
    };
    initialize();
    return () => {
      cancelled = true;
    };
  }, [gazetteId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submitQuestion = async (question) => {
    const text = String(question || input).trim();
    if (!text || sending || !gazette?.pdfUrl) return;
    const userMessage = {
      text,
      sender: "user",
      timestamp: timeLabel(),
    };
    const streamId = `stream-${Date.now()}`;
    setInput("");
    setSending(true);
    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: streamId,
        text: "",
        sender: "assistant",
        timestamp: timeLabel(),
        isStreaming: true,
      },
    ]);
    trackActivity({
      event_type: "chat_message_sent",
      entity_type: "gazette",
      entity_id: gazetteId,
      document_id: gazetteId,
      page_path: `/app/egazette-chat/${gazetteId}`,
      metadata_json: {
        documentType: gazette.notificationType || "gazette",
        ministry: gazette.ministry,
      },
    });
    try {
      await addEGazetteChatMessage(gazetteId, userMessage);
      await sendEGazetteChatMessage(
        text,
        gazetteId,
        (chunk) =>
          setMessages((current) =>
            current.map((message) =>
              message.id === streamId
                ? { ...message, text: message.text + chunk }
                : message,
            ),
          ),
        async (result) => {
          const assistantMessage = {
            id: streamId,
            text: result.response,
            sender: "assistant",
            timestamp: timeLabel(),
            sources: result.sources,
            isStreaming: false,
          };
          setMessages((current) =>
            current.map((message) =>
              message.id === streamId ? assistantMessage : message,
            ),
          );
          await addEGazetteChatMessage(gazetteId, assistantMessage);
          setSending(false);
        },
        (chatError) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === streamId
                ? {
                    ...message,
                    text: `I couldn't complete that answer: ${chatError.message}`,
                    isStreaming: false,
                    isError: true,
                  }
                : message,
            ),
          );
          setSending(false);
        },
      );
    } catch (requestError) {
      setError(requestError.message);
      setSending(false);
    }
  };

  const regenerateLastAnswer = () => {
    const lastQuestion = [...messages]
      .reverse()
      .find((message) => message.sender === "user");
    if (lastQuestion) submitQuestion(lastQuestion.text);
  };

  const clearConversation = async () => {
    await clearEGazetteChat(gazetteId);
    setMessages([]);
  };

  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-[#e9e3da]">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#8f1d2c]" />
          <p className="mt-4 text-sm text-[#706a61]">
            {processing
              ? "Preparing the Gazette PDF for research…"
              : "Opening the Gazette workspace…"}
          </p>
        </div>
      </div>
    );
  }

  if (error || !gazette) {
    return (
      <div className="grid h-screen place-items-center bg-[#e9e3da] p-6 text-center">
        <div>
          <p className="font-serif text-2xl text-[#8f1d2c]">
            Gazette workspace unavailable
          </p>
          <p className="mt-2 text-sm text-[#85434a]">{error}</p>
          <Link
            href="/app/egazette"
            className="mt-5 inline-flex rounded-full bg-[#8f1d2c] px-4 py-2.5 text-xs font-semibold text-white"
          >
            Return to eGazette
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#e9e3da]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/8 bg-[#8f1d2c] px-4 py-3 text-white sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app/egazette"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/8 text-white/70 hover:text-white"
            aria-label="Back to eGazette"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{gazette.title}</p>
            <p className="mt-1 truncate font-mono text-[10px] text-white/45">
              {gazette.gazetteNumber || "Official Gazette record"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {gazette.pdfUrl && (
            <a
              href={gazette.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/70 hover:text-white"
              aria-label="View Gazette PDF"
            >
              <FileDown className="h-4 w-4" />
            </a>
          )}
          {gazette.sourceUrl && (
            <a
              href={gazette.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/70 hover:text-white"
              aria-label="View original source"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[350px_minmax(0,1fr)_300px]">
        <aside className="app-scrollbar hidden overflow-y-auto border-r border-[#8f1d2c]/8 bg-[#f7f2eb] p-5 lg:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
            Gazette brief
          </p>
          <dl className="mt-4 space-y-3 text-xs">
            {[
              ["Published", formatDate(gazette.publicationDate)],
              ["Type", humanize(gazette.notificationType)],
              ["Gazette", humanize(gazette.gazetteType)],
              ["Ministry", gazette.ministry],
              ["Department", gazette.department],
              ["Jurisdiction", gazette.jurisdiction],
              ["Status", gazette.status],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-[#8f1d2c]/8 bg-white p-3"
                >
                  <dt className="text-[10px] uppercase tracking-[0.1em] text-[#8a8277]">
                    {label}
                  </dt>
                  <dd className="mt-1 leading-5 text-[#514d46]">{value}</dd>
                </div>
              ))}
          </dl>
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
              AI summary
            </p>
            {summary ? (
              <div className="chat-markdown mt-3 text-xs text-[#514d46]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {summary}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-[#81796e]">
                A summary is generated when a readable official PDF is
                available.
              </p>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col">
          <div className="app-scrollbar flex-1 overflow-y-auto p-4 sm:p-6">
            {messages.length === 0 ? (
              <div className="grid min-h-full place-items-center py-10 text-center">
                <div>
                  <Sparkles className="mx-auto h-7 w-7 text-[#a85a52]" />
                  <p className="mt-3 font-serif text-2xl text-[#8f1d2c]">
                    Start a Gazette research thread
                  </p>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#706a61]">
                    Ask about legal effect, implementation dates, affected
                    authorities, compliance duties, penalties, or related Acts.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
                {messages.map((message, index) => (
                  <article
                    key={message._id || message.id || `${message.sender}-${index}`}
                    className={
                      message.sender === "user"
                        ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#8f1d2c] px-5 py-4 text-white"
                        : "max-w-[92%] rounded-2xl rounded-bl-md border border-[#8f1d2c]/8 bg-[#f6f2eb] px-5 py-4 text-[#29312d] shadow-sm"
                    }
                  >
                    <div
                      className={`chat-markdown ${
                        message.sender === "user" ? "user-message" : ""
                      }`}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.text || ""}
                      </ReactMarkdown>
                    </div>
                    {message.isStreaming && (
                      <Loader2 className="mt-2 h-4 w-4 animate-spin text-[#a85a52]" />
                    )}
                    {message.sources?.length > 0 && (
                      <details className="mt-3 border-t border-[#8f1d2c]/8 pt-3">
                        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[#874047]">
                          {message.sources.length} cited passages
                        </summary>
                        <div className="mt-2 space-y-2">
                          {message.sources.map((source, sourceIndex) => (
                            <div
                              key={`${source.chunkIndex}-${sourceIndex}`}
                              className="rounded-xl bg-[#f1ece3] p-3 text-[11px] leading-5 text-[#706a61]"
                            >
                              <p className="font-semibold text-[#514d46]">
                                PDF passage {Number(source.chunkIndex || 0) + 1}
                              </p>
                              <p className="mt-1">{source.content}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </article>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[#8f1d2c]/8 bg-[#f7f2eb] p-4">
            <div className="mx-auto max-w-3xl">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={!gazette.pdfUrl || sending}
                    onClick={() => submitQuestion(question)}
                    className="whitespace-nowrap rounded-full border border-[#8f1d2c]/10 bg-white px-3 py-2 text-[10px] font-medium text-[#514d46] disabled:opacity-40"
                  >
                    {question}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2 rounded-2xl border border-[#8f1d2c]/10 bg-white p-2 shadow-sm">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitQuestion();
                    }
                  }}
                  disabled={!gazette.pdfUrl || sending}
                  placeholder={
                    gazette.pdfUrl
                      ? "Ask a grounded question about this Gazette…"
                      : "Document chat requires an official PDF"
                  }
                  rows={2}
                  className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[#29312d] outline-none placeholder:text-[#9a9387]"
                />
                <button
                  type="button"
                  disabled={!input.trim() || sending || !gazette.pdfUrl}
                  onClick={() => submitQuestion()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#8f1d2c] text-white disabled:opacity-35"
                  aria-label="Send Gazette question"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[10px] text-[#8a8277]">
                  Answers are grounded in retrieved Gazette passages.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={regenerateLastAnswer}
                    disabled={sending || !gazette.pdfUrl}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#874047] disabled:opacity-40"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={clearConversation}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#874047]"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="app-scrollbar hidden overflow-y-auto border-l border-[#8f1d2c]/8 bg-[#f7f2eb] p-5 lg:block">
          <div className="flex items-center gap-2">
            <BookOpenText className="h-4 w-4 text-[#874047]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
              Related documents
            </p>
          </div>
          <div className="mt-4 space-y-2">
            {gazette.relationships?.map((relationship) => (
              <article
                key={`${relationship.relationshipType}-${relationship.document.id}`}
                className="rounded-xl border border-[#8f1d2c]/8 bg-white p-3"
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#874047]">
                  {humanize(relationship.relationshipType)}
                </p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#29312d]">
                  {relationship.document.title}
                </p>
              </article>
            ))}
            {gazette.recommendations?.map((document) => (
              <article
                key={`recommendation-${document.id}`}
                className="rounded-xl border border-[#8f1d2c]/8 bg-white p-3"
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#874047]">
                  Related {humanize(document.notificationType)}
                </p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#29312d]">
                  {document.title}
                </p>
                {document.pdfUrl && (
                  <a
                    href={document.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#874047]"
                  >
                    Open
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </article>
            ))}
            {!gazette.relationships?.length &&
              !gazette.recommendations?.length && (
                <div className="rounded-xl border border-dashed border-[#8f1d2c]/10 p-4 text-center">
                  <RotateCcw className="mx-auto h-4 w-4 text-[#9b9387]" />
                  <p className="mt-2 text-[11px] leading-5 text-[#81796e]">
                    Related Acts, Bills, rules, and notifications will appear as
                    catalogue relationships are verified.
                  </p>
                </div>
              )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function EGazetteChatPage() {
  return (
    <ProtectedRoute>
      <EGazetteChatWorkspace />
    </ProtectedRoute>
  );
}
