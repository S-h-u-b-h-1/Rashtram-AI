"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDocumentChatMessage,
  addDocumentNote,
  clearDocumentChat,
  createDocumentChatSession,
  deleteDocumentNote,
  exportDocumentChat,
  getDocumentChatHistory,
  getDocumentResearch,
  pinDocumentChat,
  processDocumentResearch,
  saveContent,
  sendDocumentChatFeedback,
  sendDocumentChatMessage,
  trackActivity,
  updateDocumentChatSummary,
} from "@/lib/api";
import { ChatHeader } from "./ChatHeader";
import { ChatHistory } from "./ChatHistory";
import { ChatInput } from "./ChatInput";
import { ChatSidebar } from "./ChatSidebar";
import { DocumentPdfViewer } from "./DocumentPdfViewer";
import { SuggestedQuestions } from "./SuggestedQuestions";

const QUESTIONS = {
  bill: [
    "What problem does this Bill seek to solve?",
    "Which clauses create the most important legal changes?",
    "Who will be affected if this Bill becomes law?",
  ],
  act: [
    "What are the Act's principal rights and obligations?",
    "Which authorities enforce this Act?",
    "What penalties, timelines, or procedures are important?",
  ],
  gazette: [
    "What is the operative effect of this notification?",
    "Which authorities and regulated persons are affected?",
    "What compliance dates or penalties are stated?",
  ],
  default: [
    "What is this document's purpose and legal or policy effect?",
    "Which authorities, institutions, and affected groups are involved?",
    "What obligations, timelines, implementation steps, or risks are stated?",
  ],
};

const timeLabel = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export function DocumentChatLayout({
  documentType,
  documentId,
  initialDocument,
}) {
  const [document, setDocument] = useState(initialDocument || null);
  const [summary, setSummary] = useState("");
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingError, setProcessingError] = useState("");
  const [sending, setSending] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState("");
  const [responseLanguage, setResponseLanguage] = useState("English");
  const messagesEndRef = useRef(null);

  const prepareDocument = useCallback(async (canonicalDocument) => {
    if (!canonicalDocument?.pdfUrl) return "";
    setProcessing(true);
    setProcessingError("");
    try {
      const result = await processDocumentResearch(
        documentType,
        documentId,
      );
      const generatedSummary = result.summary || "";
      if (result.textArtifact) {
        setDocument((current) => ({
          ...current,
          textArtifact: result.textArtifact,
        }));
      }
      setSummary(generatedSummary);
      return generatedSummary;
    } catch (processingFailure) {
      const message =
        processingFailure.message ||
        "The document could not be prepared for AI research.";
      setProcessingError(message);
      return "";
    } finally {
      setProcessing(false);
    }
  }, [documentId, documentType]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        setLoading(true);
        setError("");
        const detail = await getDocumentResearch(documentType, documentId);
        if (cancelled) return;
        const canonical = {
          ...(initialDocument || {}),
          ...(detail.document || {}),
        };
        setDocument(canonical);
        trackActivity({
          event_type: "chat_started",
          entity_type: documentType,
          entity_id: documentId,
          document_id: documentId,
          page_path: `/app/document/${documentId}`,
          metadata_json: { documentType },
        });
        const history = await getDocumentChatHistory(
          documentType,
          documentId,
        ).catch(() => ({ chat: null, notes: [] }));
        if (cancelled) return;
        setNotes(history.notes || []);
        if (history.chat?.messages?.length) {
          setMessages(history.chat.messages);
          setSummary(history.chat.summary || "");
          setIsPinned(Boolean(history.chat.isPinned));
          return;
        }

        let generatedSummary = "";
        if (canonical.pdfUrl) {
          generatedSummary = await prepareDocument(canonical);
        }
        if (cancelled) return;
        setSummary(generatedSummary);
        const session = await createDocumentChatSession(
          documentType,
          documentId,
          generatedSummary,
        );
        setIsPinned(Boolean(session.chat?.isPinned));
        const welcome = {
          text: canonical.pdfUrl
            ? `I've prepared **${canonical.title}** for evidence-grounded research. Ask about provisions, implementation, affected institutions, or related records.`
            : `I can show verified metadata for **${canonical.title}**, but grounded chat requires an official PDF.`,
          sender: "assistant",
          timestamp: timeLabel(),
        };
        setMessages([welcome]);
        await addDocumentChatMessage(
          documentType,
          documentId,
          welcome,
        );
        if (generatedSummary) {
          await updateDocumentChatSummary(
            documentType,
            documentId,
            generatedSummary,
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || "Unable to open this workspace.");
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
  }, [documentId, documentType, initialDocument, prepareDocument]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submitQuestion = async (question) => {
    const text = String(question || input).trim();
    if (!text || sending || !document?.pdfUrl) return;
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
      entity_type: documentType,
      entity_id: documentId,
      document_id: documentId,
      page_path: `/app/document/${documentId}`,
      metadata_json: { documentType },
    });
    try {
      await addDocumentChatMessage(
        documentType,
        documentId,
        userMessage,
      );
      await sendDocumentChatMessage(
        text,
        documentType,
        documentId,
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
          await addDocumentChatMessage(
            documentType,
            documentId,
            assistantMessage,
          );
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
        responseLanguage,
      );
    } catch (requestError) {
      setError(requestError.message);
      setSending(false);
    }
  };

  const regenerate = () => {
    const lastQuestion = [...messages]
      .reverse()
      .find((message) => message.sender === "user");
    if (lastQuestion) submitQuestion(lastQuestion.text);
  };

  const clear = async () => {
    await clearDocumentChat(documentType, documentId);
    setMessages([]);
  };

  const addNote = async (body) => {
    const response = await addDocumentNote(
      documentType,
      documentId,
      body,
    );
    setNotes((current) => [response.note, ...current]);
  };

  const removeNote = async (noteId) => {
    await deleteDocumentNote(noteId);
    setNotes((current) =>
      current.filter((note) => String(note.id) !== String(noteId)),
    );
  };

  const togglePin = async () => {
    const next = !isPinned;
    await pinDocumentChat(documentType, documentId, next);
    setIsPinned(next);
  };

  const bookmark = async () => {
    await saveContent({
      itemType: "bookmark",
      documentType,
      documentId,
      title: document.title,
      metadata: {
        sourceUrl: document.sourceUrl,
        pdfUrl: document.pdfUrl,
      },
    });
  };

  const feedback = async (message, rating) => {
    await sendDocumentChatFeedback({
      documentType,
      documentId,
      messageId: message._id || message.id,
      rating,
    });
  };

  const retryProcessing = async () => {
    const generatedSummary = await prepareDocument(document);
    if (!generatedSummary) return;
    await updateDocumentChatSummary(
      documentType,
      documentId,
      generatedSummary,
    ).catch(() => undefined);
  };

  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-[#e9e3da]">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#8f1d2c]" />
          <p className="mt-4 text-sm text-[#706a61]">
            {processing
              ? "Preparing AI Research Workspace…"
              : "Opening the research workspace…"}
          </p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="grid h-screen place-items-center bg-[#e9e3da] p-6 text-center">
        <div>
          <p className="font-serif text-2xl text-[#8f1d2c]">
            Research workspace unavailable
          </p>
          <p className="mt-2 text-sm text-[#85434a]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#e9e3da]">
      <ChatHeader
        document={document}
        isPinned={isPinned}
        onPin={togglePin}
        onBookmark={bookmark}
        onExport={() => exportDocumentChat(documentType, documentId)}
      />
      {error && (
        <p className="shrink-0 bg-[#f4dfdc] px-4 py-2 text-center text-xs text-[#85434a]">
          {error}
        </p>
      )}
      {processingError && (
        <div className="flex shrink-0 items-center justify-between gap-3 bg-[#f4dfdc] px-4 py-2 text-xs text-[#85434a] xl:hidden">
          <span className="line-clamp-2">
            Processing failed. {processingError}
          </span>
          <button
            type="button"
            onClick={retryProcessing}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#8f1d2c] px-2.5 py-1.5 text-[10px] font-semibold text-white"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}
      <details className="shrink-0 border-b border-[#8f1d2c]/8 bg-[#f7f2eb] xl:hidden">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#874047]">
          Document brief, sources, relationships, and notes
        </summary>
        <div className="app-scrollbar max-h-[55vh] overflow-y-auto p-4">
          <ChatSidebar
            document={document}
            summary={summary}
            notes={notes}
            onAddNote={addNote}
            onDeleteNote={removeNote}
          />
        </div>
      </details>
      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(360px,0.9fr)_minmax(440px,1.1fr)] 2xl:grid-cols-[minmax(380px,0.9fr)_340px_minmax(460px,1.1fr)]">
        <div className="hidden min-h-0 xl:block">
          <DocumentPdfViewer
            document={document}
            processing={processing}
            processingError={processingError}
            onRetry={retryProcessing}
          />
        </div>
        <aside className="app-scrollbar hidden overflow-y-auto border-r border-[#8f1d2c]/8 bg-[#f7f2eb] p-5 2xl:block">
          <ChatSidebar
            document={document}
            summary={summary}
            notes={notes}
            onAddNote={addNote}
            onDeleteNote={removeNote}
          />
        </aside>
        <main id="research-chat" className="flex min-h-0 flex-col">
          <div className="paper-grid app-scrollbar flex-1 overflow-y-auto p-4 sm:p-6">
            <ChatHistory
              messages={messages}
              messagesEndRef={messagesEndRef}
              onFeedback={feedback}
            />
          </div>
          <SuggestedQuestions
            questions={QUESTIONS[documentType] || QUESTIONS.default}
            disabled={!document.pdfUrl || sending}
            onSelect={(question) => submitQuestion(question)}
          />
          <ChatInput
            input={input}
            setInput={setInput}
            sending={sending}
            disabled={!document.pdfUrl}
            onSend={submitQuestion}
            onRegenerate={regenerate}
            onClear={clear}
            responseLanguage={responseLanguage}
            onResponseLanguageChange={setResponseLanguage}
          />
        </main>
      </div>
    </div>
  );
}
