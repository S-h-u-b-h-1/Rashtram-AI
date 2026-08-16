"use client";

import {
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
} from "lucide-react";
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
  getResearchSources,
  addResearchUrlSource,
  addResearchPdfSource,
  deleteResearchSource,
  pinDocumentChat,
  processDocumentResearch,
  saveContent,
  sendDocumentChatFeedback,
  sendDocumentChatMessage,
  trackActivity,
  updateDocumentChatSummary,
} from "@/lib/api";
import { canPrepareDocumentForResearch } from "@/lib/document-readiness";
import { ChatHeader } from "./ChatHeader";
import { ChatHistory } from "./ChatHistory";
import { ChatInput } from "./ChatInput";
import { StudySourcesPanel } from "./StudySourcesPanel";
import { StudioPanel } from "./StudioPanel";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { useSmoothMessageStream } from "@/hooks/useSmoothMessageStream";
import { usePinnedChatScroll } from "@/hooks/usePinnedChatScroll";

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
  const [researchReady, setResearchReady] = useState(
    Boolean(initialDocument?.researchReady),
  );
  const [sending, setSending] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState("");
  const [responseLanguage, setResponseLanguage] = useState("Auto");
  const [studySources, setStudySources] = useState([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [studioOpen, setStudioOpen] = useState(true);
  const abortControllerRef = useRef(null);
  const smoothStream = useSmoothMessageStream(setMessages);
  const {
    handleScroll,
    messagesEndRef,
    pinToLatest,
    scrollContainerRef,
  } = usePinnedChatScroll(messages);

  const prepareDocument = useCallback(async (canonicalDocument) => {
    if (
      !canonicalDocument?.pdfUrl &&
      !canonicalDocument?.sourceUrl &&
      canonicalDocument?.type !== "policy"
    ) return null;
    setProcessing(true);
    setProcessingError("");
    try {
      const result = await processDocumentResearch(
        documentType,
        documentId,
      );
      const readiness = result.readiness || {};
      const generatedSummary = result.summary || "";
      if (result.textArtifact) {
        setDocument((current) => ({
          ...current,
          textArtifact: result.textArtifact,
        }));
      }
      setSummary(generatedSummary);
      setResearchReady(Boolean(readiness.researchReady ?? result.researchReady));
      setDocument((current) => ({
        ...current,
        researchReady: Boolean(readiness.researchReady ?? result.researchReady),
        comparisonReady: Boolean(
          readiness.comparisonReady ?? result.comparisonReady,
        ),
        readiness: readiness.researchReady || result.researchReady
          ? "research_ready"
          : current.readiness,
        readinessClass: readiness.comparisonReady || result.comparisonReady
          ? "comparison_ready"
          : readiness.researchReady || result.researchReady
            ? "research_ready"
            : readiness.readinessClass || current.readinessClass,
        readinessReason: readiness.reason || readiness.readinessReason || null,
        processingStatus:
          readiness.status === "ready" || result.researchReady
            ? "ready"
            : current.processingStatus,
        extractionStatus: readiness.requirements?.hasExtractedText
          ? "ready"
          : current.extractionStatus,
        embeddingStatus:
          readiness.embeddingStatus || current.embeddingStatus,
        chunksCount: readiness.counts?.chunks ?? current.chunksCount,
        embeddingsCount:
          readiness.counts?.embeddings ?? current.embeddingsCount,
        retrievalMode: readiness.retrievalMode || current.retrievalMode,
      }));
      return result;
    } catch (processingFailure) {
      const message =
        processingFailure.message ||
        "The document could not be prepared for AI research.";
      setProcessingError(message);
      setResearchReady(false);
      return null;
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
        const [detail, sourceResponse] = await Promise.all([
          getDocumentResearch(documentType, documentId),
          getResearchSources().catch(() => ({ sources: [] })),
        ]);
        if (cancelled) return;
        setStudySources(sourceResponse.sources || []);
        const canonical = {
          ...(initialDocument || {}),
          ...(detail.document || {}),
        };
        setDocument(canonical);
        setResearchReady(Boolean(canonical.researchReady));
        trackActivity({
          event_type: "chat_started",
          entity_type: documentType,
          entity_id: documentId,
          document_id: documentId,
          page_path: `/app/document/${documentId}`,
          metadata_json: { documentType },
        });
        if (!canonical.researchReady) {
          setMessages([]);
          return;
        }
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

        const generatedSummary =
          history.chat?.summary ||
          canonical.summary ||
          "";
        if (cancelled) return;
        setSummary(generatedSummary);
        const session = await createDocumentChatSession(
          documentType,
          documentId,
          generatedSummary,
        );
        setIsPinned(Boolean(session.chat?.isPinned));
        const welcome = {
          text: `I've prepared **${canonical.title}** for evidence-grounded research. Ask about provisions, implementation, affected institutions, or related records.`,
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
  }, [documentId, documentType, initialDocument]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const submitQuestion = async (question, options = {}) => {
    const text = String(question || input).trim();
    const chatEnabled = researchReady || selectedSourceIds.length > 0;
    if (!text || sending || !chatEnabled) return;
    const displayText = String(options.displayText || text).trim();
    const workflow = options.workflow || null;
    const userMessage = {
      text: displayText,
      sender: "user",
      timestamp: timeLabel(),
      metadata: workflow
        ? {
            workflowId: workflow.id,
            workflowTitle: workflow.title,
            workflowGroup: workflow.groupTitle,
            executionPrompt: text,
          }
        : undefined,
    };
    const streamId = `stream-${Date.now()}`;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    smoothStream.start(streamId);
    pinToLatest();
    setInput("");
    setSending(true);
    setError("");
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
    const userSavePromise = addDocumentChatMessage(
      documentType,
      documentId,
      userMessage,
    ).then(
      () => null,
      (saveError) => saveError,
    );
    try {
      const result = await sendDocumentChatMessage({
        message: text,
        documentType,
        documentId,
        responseLanguage,
        sourceIds: selectedSourceIds,
        workflow: workflow
          ? {
              id: workflow.id,
              title: workflow.title,
              group: workflow.groupTitle,
            }
          : undefined,
        signal: controller.signal,
        onChunk: (chunk) => smoothStream.append(streamId, chunk),
      });
      smoothStream.complete(streamId, result);
      const assistantMessage = {
        id: streamId,
        text: result.response,
        sender: "assistant",
        timestamp: timeLabel(),
        sources: result.sources,
        metadata: {
          ...(result.metadata || {}),
          ...(workflow
            ? {
                workflowId: workflow.id,
                workflowTitle: workflow.title,
                workflowGroup: workflow.groupTitle,
              }
            : {}),
        },
        isStreaming: false,
      };
      const userSaveError = await userSavePromise;
      const assistantSaveError = await addDocumentChatMessage(
          documentType,
          documentId,
          assistantMessage,
        ).then(
          () => null,
          (saveError) => saveError,
        );
      if (userSaveError || assistantSaveError) {
        setError(
          "The response completed, but chat history could not be saved. Please retry before leaving this page.",
        );
      }
    } catch (requestError) {
      const stopped =
        controller.signal.aborted || requestError.name === "AbortError";
      smoothStream.fail(streamId, { stopped });
      if (!stopped) {
        setError("Response generation was interrupted. Please try again.");
      }
      await userSavePromise;
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setSending(false);
    }
  };

  const regenerate = () => {
    const lastQuestion = [...messages]
      .reverse()
      .find((message) => message.sender === "user");
    if (!lastQuestion) return;
    const workflow = lastQuestion.metadata?.workflowTitle
      ? {
          id: lastQuestion.metadata.workflowId,
          title: lastQuestion.metadata.workflowTitle,
          groupTitle: lastQuestion.metadata.workflowGroup,
        }
      : null;
    submitQuestion(
      lastQuestion.metadata?.executionPrompt || lastQuestion.text,
      workflow
        ? {
            displayText: lastQuestion.text,
            workflow,
          }
        : undefined,
    );
  };

  const runWorkflow = (workflow) => {
    if (!workflow?.prompt) return;
    submitQuestion(workflow.prompt, {
      displayText: `Run workflow: ${workflow.title}`,
      workflow,
    });
  };

  const clear = async () => {
    abortControllerRef.current?.abort();
    await clearDocumentChat(documentType, documentId);
    setMessages([]);
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
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
    const result = await prepareDocument(document);
    if (!result?.researchReady) return;
    await updateDocumentChatSummary(
      documentType,
      documentId,
      result.summary || "",
    ).catch(() => undefined);
  };

  const addUrlSource = async (url) => {
    const result = await addResearchUrlSource(url);
    const source = result.source;
    setStudySources((current) => [source, ...current.filter((item) => item.id !== source.id)]);
    setSelectedSourceIds((current) => current.includes(String(source.id)) ? current : [...current, String(source.id)]);
  };

  const addPdfSource = async (file) => {
    const result = await addResearchPdfSource(file);
    const source = result.source;
    setStudySources((current) => [source, ...current.filter((item) => item.id !== source.id)]);
    setSelectedSourceIds((current) => current.includes(String(source.id)) ? current : [...current, String(source.id)]);
  };

  const toggleStudySource = (sourceId) => {
    setSelectedSourceIds((current) => current.includes(String(sourceId))
      ? current.filter((id) => id !== String(sourceId))
      : [...current, String(sourceId)]);
  };

  const removeStudySource = async (sourceId) => {
    await deleteResearchSource(sourceId);
    setStudySources((current) => current.filter((source) => String(source.id) !== String(sourceId)));
    setSelectedSourceIds((current) => current.filter((id) => id !== String(sourceId)));
  };

  if (loading) {
    return (
      <div className="grid h-dvh place-items-center bg-[#e9e3da]">
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
      <div className="grid h-dvh place-items-center bg-[#e9e3da] p-6 text-center">
        <div>
          <p className="font-serif text-2xl text-[#8f1d2c]">
            Research workspace unavailable
          </p>
          <p className="mt-2 text-sm text-[#85434a]">{error}</p>
        </div>
      </div>
    );
  }

  const suggestedQuestions =
    document.textArtifact?.metadata?.suggestedQuestions?.length > 0
      ? document.textArtifact.metadata.suggestedQuestions
      : QUESTIONS[documentType] || QUESTIONS.default;
  const canPrepareCurrentDocument = canPrepareDocumentForResearch(document);

  const chatEnabled = researchReady || selectedSourceIds.length > 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#e9e3da]">
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
        <div className="flex shrink-0 items-center justify-between gap-3 bg-[#f4dfdc] px-4 py-2 text-xs text-[#85434a]">
          <span className="line-clamp-2">
            Processing failed. {processingError}
          </span>
          {canPrepareCurrentDocument && (
            <button
              type="button"
              onClick={retryProcessing}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#8f1d2c] px-2.5 py-1.5 text-[10px] font-semibold text-white"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      )}
      <div className={`grid min-h-0 flex-1 ${sourcesOpen && studioOpen ? "lg:grid-cols-[280px_minmax(0,1fr)_340px]" : sourcesOpen ? "lg:grid-cols-[280px_minmax(0,1fr)]" : studioOpen ? "lg:grid-cols-[minmax(0,1fr)_340px]" : "lg:grid-cols-1"}`}>
        {sourcesOpen && <aside className="hidden min-h-0 overflow-hidden border-r border-[#8f1d2c]/10 lg:block">
          <StudySourcesPanel
            sources={studySources}
            selectedIds={selectedSourceIds}
            onToggle={toggleStudySource}
            onAddUrl={addUrlSource}
            onAddPdf={addPdfSource}
            onDelete={removeStudySource}
          />
        </aside>}
        <main id="research-chat" className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-[#8f1d2c]/8 bg-[#f7f2eb] px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">Chat</p>
              <p className="mt-1 truncate text-xs text-[#706a61]">Ask questions across the selected sources and this document.</p>
            </div>
            <div className="ml-3 flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => setSourcesOpen((open) => !open)} className="hidden h-8 w-8 place-items-center rounded-lg border border-[#8f1d2c]/12 bg-white text-[#874047] transition hover:bg-[#eee0dc] lg:grid" aria-label={sourcesOpen ? "Collapse sources" : "Expand sources"} title={sourcesOpen ? "Collapse sources" : "Expand sources"}>
                {sourcesOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => setStudioOpen((open) => !open)} className="hidden h-8 w-8 place-items-center rounded-lg border border-[#8f1d2c]/12 bg-white text-[#874047] transition hover:bg-[#eee0dc] lg:grid" aria-label={studioOpen ? "Collapse studio" : "Expand studio"} title={studioOpen ? "Collapse studio" : "Expand studio"}>
                {studioOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </button>
              <span className="rounded-full border border-[#8f1d2c]/12 bg-white px-2.5 py-1 text-[10px] font-semibold text-[#874047]">{selectedSourceIds.length + (researchReady ? 1 : 0)} sources in context</span>
            </div>
          </div>
          <details className="shrink-0 border-b border-[#8f1d2c]/8 bg-[#f7f2eb] lg:hidden">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#874047]">Sources and study context</summary>
            <div className="max-h-[55vh] overflow-hidden">
              <StudySourcesPanel
                sources={studySources}
                selectedIds={selectedSourceIds}
                onToggle={toggleStudySource}
                onAddUrl={addUrlSource}
                onAddPdf={addPdfSource}
                onDelete={removeStudySource}
              />
            </div>
          </details>
          <details className="shrink-0 border-b border-[#8f1d2c]/8 bg-[#f7f2eb] lg:hidden">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#874047]">Studio and research outputs</summary>
            <div className="max-h-[60vh] overflow-hidden">
              <StudioPanel
                document={document}
                summary={summary}
                notes={notes}
                onAddNote={addNote}
                onDeleteNote={removeNote}
                disabled={sending || processing}
                onRunWorkflow={runWorkflow}
              />
            </div>
          </details>
          {!researchReady && !processing && (
            <div className="border-b border-[#8f1d2c]/8 bg-[#fffaf0] px-4 py-3 text-xs text-[#706a61]">
              <p className="font-semibold text-[#8f1d2c]">
                Research is not ready for this document.
              </p>
              <p className="mt-1">
                {processingError ||
                  document.readinessReason ||
                  (canPrepareCurrentDocument
                    ? "Choose Retry to prepare searchable passages."
                    : "Open the source link when available; grounded research and comparison are disabled for this record.")}
              </p>
              {canPrepareCurrentDocument && !processingError && (
                <button
                  type="button"
                  onClick={retryProcessing}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#8f1d2c] px-2.5 py-1.5 text-[10px] font-semibold text-white"
                >
                  <RefreshCw className="h-3 w-3" />
                  Prepare for Research
                </button>
              )}
            </div>
          )}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="paper-grid app-scrollbar flex-1 overflow-y-auto p-4 sm:p-6"
          >
            <ChatHistory
              messages={messages}
              messagesEndRef={messagesEndRef}
              onFeedback={feedback}
            />
          </div>
          <SuggestedQuestions
            questions={suggestedQuestions}
            disabled={!chatEnabled || sending}
            onSelect={(question) => submitQuestion(question)}
          />
          <ChatInput
            input={input}
            setInput={setInput}
            sending={sending}
            disabled={!chatEnabled}
            onSend={submitQuestion}
            onStop={stopGeneration}
            onRegenerate={regenerate}
            onClear={clear}
            responseLanguage={responseLanguage}
            onResponseLanguageChange={setResponseLanguage}
          />
        </main>
        {studioOpen && <aside className="hidden min-h-0 overflow-hidden border-l border-[#8f1d2c]/10 lg:block">
          <StudioPanel
            document={document}
            summary={summary}
            notes={notes}
            onAddNote={addNote}
            onDeleteNote={removeNote}
            disabled={sending || processing}
            onRunWorkflow={runWorkflow}
          />
        </aside>}
      </div>
    </div>
  );
}
