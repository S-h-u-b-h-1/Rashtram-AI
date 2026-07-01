"use client";

import { FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  fetchDocument,
  processDocumentResearch,
  sendCrossDocumentChat,
} from "@/lib/api";
import { ChatHistory } from "@/components/document-chat/ChatHistory";
import { ChatInput } from "@/components/document-chat/ChatInput";

const timeLabel = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export function MultiDocumentChat({ documentIds }) {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [responseLanguage, setResponseLanguage] = useState("Auto");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all(documentIds.map((id) => fetchDocument(id)))
      .then(async (responses) => {
        const loadedDocuments = responses.map(
          (response) => response.document,
        );
        if (active) {
          setDocuments(loadedDocuments);
        }
        const preparation = await Promise.allSettled(
          loadedDocuments
            .filter((document) => document.pdfUrl)
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
    };
  }, [documentIds]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = (question = input) => {
    const text = String(question || "").trim();
    if (!text || sending || !documents.length) return;
    const streamId = `cross-${Date.now()}`;
    const userMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: timeLabel(),
    };
    setInput("");
    setSending(true);
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
    sendCrossDocumentChat(
      text,
      documents.map((document) => document.id),
      (chunk) =>
        setMessages((current) =>
          current.map((message) =>
            message.id === streamId
              ? { ...message, text: message.text + chunk }
              : message,
          ),
        ),
      ({ response, sources }) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === streamId
              ? {
                  ...message,
                  text: response,
                  sources,
                  isStreaming: false,
                }
              : message,
          ),
        );
        setSending(false);
      },
      (requestError) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === streamId
              ? {
                  ...message,
                  text: `Cross-document analysis failed: ${requestError.message}`,
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
    <section className="surface-card flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden">
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
      <div className="paper-grid app-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
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
        onRegenerate={regenerate}
        onClear={() => setMessages([])}
        responseLanguage={responseLanguage}
        onResponseLanguageChange={setResponseLanguage}
      />
    </section>
  );
}
