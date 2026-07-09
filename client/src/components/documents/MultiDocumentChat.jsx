"use client";

import { FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  fetchDocument,
  clearCrossDocumentChatHistory,
  getCrossDocumentChatHistory,
  processDocumentResearch,
  sendCrossDocumentChat,
} from "@/lib/api";
import { ChatHistory } from "@/components/document-chat/ChatHistory";
import { ChatInput } from "@/components/document-chat/ChatInput";
import { useSmoothMessageStream } from "@/hooks/useSmoothMessageStream";
import { usePinnedChatScroll } from "@/hooks/usePinnedChatScroll";

const timeLabel = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export function MultiDocumentChat({ documentIds, comparisonId = null }) {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [responseLanguage, setResponseLanguage] = useState("Auto");
  const abortControllerRef = useRef(null);
  const smoothStream = useSmoothMessageStream(setMessages);
  const {
    handleScroll,
    messagesEndRef,
    pinToLatest,
    scrollContainerRef,
  } = usePinnedChatScroll(messages);

  useEffect(() => {
    let active = true;
    Promise.all([
      Promise.all(documentIds.map((id) => fetchDocument(id))),
      getCrossDocumentChatHistory(documentIds).catch(() => ({ messages: [] })),
    ])
      .then(async ([responses, history]) => {
        const loadedDocuments = responses.map(
          (response) => response.document,
        );
        if (active) {
          setDocuments(loadedDocuments);
          setMessages(history.messages || []);
        }
        const preparation = await Promise.allSettled(
          loadedDocuments
            .filter((document) => document.pdfUrl && !document.researchReady)
            .map((document) =>
              processDocumentResearch(document.type, document.id),
            ),
        );
        const failed = preparation.filter(
          (result) => result.status === "rejected",
        ).length;
        if (
          active &&
          (!preparation.length || failed === preparation.length)
        ) {
          setError(
            "The selected documents could not be prepared for grounded comparison.",
          );
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      abortControllerRef.current?.abort();
    };
  }, [documentIds]);

  const submit = async (question = input) => {
    const text = String(question || "").trim();
    if (!text || sending || !documents.length) return;
    const streamId = `cross-${Date.now()}`;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    smoothStream.start(streamId);
    pinToLatest();
    const userMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: timeLabel(),
    };
    setInput("");
    setSending(true);
    setError("");
    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: streamId,
        sender: "assistant",
        text: "",
        timestamp: timeLabel(),
        isStreaming: true,
      },
    ]);
    try {
      const result = await sendCrossDocumentChat({
        message: text,
        documentIds: documents.map((document) => document.id),
        comparisonId,
        responseLanguage,
        signal: controller.signal,
        onChunk: (chunk) => smoothStream.append(streamId, chunk),
      });
      smoothStream.complete(streamId, result);
    } catch (requestError) {
      const stopped =
        controller.signal.aborted || requestError.name === "AbortError";
      smoothStream.fail(streamId, { stopped });
      if (!stopped) {
        setError("Response generation was interrupted. Please try again.");
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setSending(false);
    }
  };

  const clear = async () => {
    abortControllerRef.current?.abort();
    try {
      await clearCrossDocumentChatHistory(documentIds);
      setMessages([]);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const regenerate = () => {
    const lastQuestion = [...messages]
      .reverse()
      .find((message) => message.sender === "user");
    if (lastQuestion) submit(lastQuestion.text);
  };

  if (loading) {
    return (
      <div className="grid min-h-[600px] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#8f1d2c]" />
      </div>
    );
  }

  return (
    <section className="surface-card flex h-[calc(100dvh-10rem)] min-h-[420px] min-w-0 flex-col overflow-hidden">
      <header className="border-b border-[#8f1d2c]/8 bg-[#f7f2eb] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
          Cross-document research
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
          One conversation, multiple legal records
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {documents.map((document) => (
            <span
              key={document.id}
              className="inline-flex max-w-sm items-center gap-1.5 rounded-full bg-[#eee0dc] px-3 py-1.5 text-[10px] font-semibold text-[#514d46]"
            >
              <FileText className="h-3 w-3 shrink-0 text-[#8f1d2c]" />
              <span className="truncate">{document.title}</span>
            </span>
          ))}
        </div>
        {error && <p className="mt-3 text-xs text-[#85434a]">{error}</p>}
      </header>
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="paper-grid app-scrollbar min-h-0 flex-1 overflow-y-auto p-5"
      >
        <ChatHistory
          messages={messages}
          messagesEndRef={messagesEndRef}
          onFeedback={async () => {}}
        />
      </div>
      <ChatInput
        input={input}
        setInput={setInput}
        sending={sending}
        disabled={!documents.length}
        onSend={() => submit()}
        onStop={stopGeneration}
        onRegenerate={regenerate}
        onClear={clear}
        responseLanguage={responseLanguage}
        onResponseLanguageChange={setResponseLanguage}
      />
    </section>
  );
}
