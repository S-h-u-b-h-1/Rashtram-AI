"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Send,
  Loader2,
  FileText,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  BarChart3,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import {
  processAct,
  getActSummary,
  sendActChatMessage,
  getOrCreateActChat,
  getActChat,
  addMessageToActChat,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

function ActChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [actData, setActData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [showSummary, setShowSummary] = useState(true);
  const [isCachedSummary, setIsCachedSummary] = useState(false);
  const [isCachedChat, setIsCachedChat] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const actParam = searchParams.get("act");
    if (actParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(actParam));
        setActData(parsed);
        initializeAct(parsed);
      } catch (err) {
        console.error("Error parsing act data:", err);
        setError("Invalid act data");
        setIsLoading(false);
      }
    } else {
      setError("No act data provided");
      setIsLoading(false);
    }
  }, [searchParams]);

  const initializeAct = async (act) => {
    try {
      setIsLoading(true);
      setError(null);

      try {
        console.log("Checking MongoDB for existing chat...");
        const existingChatResult = await getActChat(act.actId.toString());

        if (
          existingChatResult.success &&
          existingChatResult.chat &&
          existingChatResult.chat.messages.length > 0
        ) {
          console.log("Loaded chat from MongoDB (instant sync)");
          setSummary(existingChatResult.chat.summary);

          const sanitizedMessages = existingChatResult.chat.messages.map(
            (msg) => ({
              ...msg,
              text:
                typeof msg.text === "object"
                  ? JSON.stringify(msg.text)
                  : msg.text,
            })
          );
          setMessages(sanitizedMessages);
          setIsCachedChat(true);
          setIsLoading(false);
          return;
        } else {
          console.log("No existing chat found, will create new one");
        }
      } catch (dbError) {
        if (dbError.message.includes("404")) {
          console.log("Chat not found in MongoDB, creating new one");
        } else {
          console.warn(
            "MongoDB error, will fetch fresh data:",
            dbError.message
          );
        }
      }

      let pdfUrl = act.pdfUrl;

      console.log("Processing act...");
      const processResult = await processAct(
        act.actId.toString(),
        pdfUrl,
        act.title
      );

      console.log("Fetching summary...");
      const summaryResult = await getActSummary(act.actId.toString());
      console.log("Summary result:", summaryResult);

      if (summaryResult && summaryResult.summary) {
        console.log(
          "Summary received:",
          summaryResult.summary.substring(0, 100) + "..."
        );
        setSummary(summaryResult.summary);
        setIsCachedSummary(false);

        const initialMessages = [
          {
            text: `I've analyzed **${act.title}**. Feel free to ask me any questions about this act!`,
            sender: "assistant",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ];
        setMessages(initialMessages);

        try {
          console.log("Saving chat to MongoDB...");
          const chatResult = await getOrCreateActChat(
            act.actId.toString(),
            act.title,
            act.status,
            pdfUrl,
            summaryResult.summary
          );

          if (chatResult.chat && chatResult.chat.messages.length === 0) {
            await addMessageToActChat(act.actId.toString(), initialMessages[0]);
          }

          console.log("Chat saved to MongoDB");
        } catch (dbError) {
          console.warn("Failed to save to MongoDB:", dbError.message);
        }
      } else {
        console.log("No summary available in response:", summaryResult);
        const fallbackMessages = [
          {
            text: `I'm ready to discuss **${act.title}**. What would you like to know?`,
            sender: "assistant",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ];
        setMessages(fallbackMessages);

        try {
          await getOrCreateActChat(
            act.actId.toString(),
            act.title,
            act.status,
            act.pdfUrl,
            null
          );
          await addMessageToActChat(act.actId.toString(), fallbackMessages[0]);
        } catch (dbError) {
          console.warn("Failed to save to MongoDB:", dbError.message);
        }
      }
    } catch (err) {
      console.error("Error initializing act:", err);
      setError(err.message || "Failed to load act data");
      setMessages([
        {
          id: 1,
          text: `I'm having trouble loading this act. However, I can try to answer your questions about **${act.title}** based on available information.`,
          sender: "assistant",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsLoading(false);

      setTimeout(() => {
        generateSuggestedQuestions(act);
      }, 1000);
    }
  };

  const generateSuggestedQuestions = async (actDataParam = null) => {
    const currentActData = actDataParam || actData;

    if (!showSuggestions) {
      console.log("Skipping suggestions - dropdown is closed");
      return;
    }

    if (!currentActData || !currentActData.actId) {
      console.log("Skipping suggestions - act data not ready");
      return;
    }

    try {
      setGeneratingSuggestions(true);
      console.log("Generating suggested questions...");

      const lastUserMessage =
        messages.length > 0
          ? messages.filter((m) => m.sender === "user").slice(-1)[0]?.text
          : null;

      const prompt = lastUserMessage
        ? `Act: "${currentActData.title}"\nLast Q: "${lastUserMessage.substring(
            0,
            100
          )}"\n3 follow-up questions as JSON array:`
        : `Act: "${currentActData.title}"\n3 starter questions as JSON array:`;

      const response = await new Promise((resolve, reject) => {
        sendActChatMessage(
          prompt,
          currentActData.actId.toString(),
          () => {},
          (result) => resolve(result),
          (error) => reject(error)
        );
      });

      let questions = [];
      try {
        const jsonMatch = response.response.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          questions = parsed.map((item) => {
            if (typeof item === "string") {
              return item;
            } else if (typeof item === "object" && item !== null) {
              return (
                item.question || item.text || item.q || JSON.stringify(item)
              );
            }
            return String(item);
          });
        }
      } catch (e) {
        console.log("Failed to parse JSON, trying text parsing...");

        const lines = response.response.split("\n");
        questions = lines
          .filter((line) => {
            const trimmed = line.trim();
            return (
              trimmed.length > 0 &&
              (trimmed.match(/^\d+\./) ||
                trimmed.startsWith('"') ||
                trimmed.startsWith("-"))
            );
          })
          .map((line) =>
            line
              .replace(/^\d+\.\s*/, "")
              .replace(/^[-"']\s*/, "")
              .replace(/["']$/, "")
              .trim()
          )
          .filter((q) => q.length > 10 && q.length < 150 && q.includes("?"))
          .slice(0, 3);
      }

      // Ensure all questions are strings
      questions = questions.filter(
        (q) => typeof q === "string" && q.length > 0
      );

      if (questions.length > 0) {
        setSuggestedQuestions(questions);
        console.log(`Generated ${questions.length} suggestions`);
      } else {
        // Fallback default questions
        setSuggestedQuestions([
          "What are the main objectives of this act?",
          "Who will be affected by this legislation?",
          "What are the key provisions and clauses?",
        ]);
      }
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
      setSuggestedQuestions([
        "Can you explain the key provisions?",
        "What impact will this act have?",
        "When was this act implemented?",
      ]);
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending || !actData) return;

    const userMessage = {
      text: inputMessage,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const updatedMessagesWithUser = [...messages, userMessage];
    setMessages(updatedMessagesWithUser);
    const currentInput = inputMessage;
    setInputMessage("");
    setIsSending(true);

    // Create a placeholder for the assistant's message
    const assistantMessageId = Date.now();
    const initialAssistantMessage = {
      id: assistantMessageId,
      text: "",
      sender: "assistant",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, initialAssistantMessage]);

    try {
      try {
        await addMessageToActChat(actData.actId.toString(), userMessage);
        console.log("User message saved to MongoDB");
      } catch (dbError) {
        console.warn(
          "Failed to save user message to MongoDB:",
          dbError.message
        );
      }

      await sendActChatMessage(
        currentInput,
        actData.actId.toString(),
        (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, text: msg.text + chunk }
                : msg
            )
          );
        },
        async (result) => {
          const finalAssistantMessage = {
            ...initialAssistantMessage,
            text: result.response,
            sources: result.sources,
            isStreaming: false,
          };

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? finalAssistantMessage : msg
            )
          );

          try {
            await addMessageToActChat(
              actData.actId.toString(),
              finalAssistantMessage
            );
            console.log("Assistant message saved to MongoDB");
          } catch (dbError) {
            console.warn(
              "Failed to save assistant message to MongoDB:",
              dbError.message
            );
          }

          generateSuggestedQuestions();
          setIsSending(false);
        },
        (error) => {
          console.error("Error sending message:", error);
          const errorMessage = {
            text: "Sorry, I encountered an error. Please try again.",
            sender: "assistant",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isError: true,
          };

          setMessages((prev) =>
            prev
              .filter((msg) => msg.id !== assistantMessageId)
              .concat(errorMessage)
          );

          try {
            addMessageToActChat(actData.actId.toString(), errorMessage);
          } catch (dbError) {
            console.warn(
              "Failed to save error message to MongoDB:",
              dbError.message
            );
          }
          setIsSending(false);
        }
      );
    } catch (err) {
      console.error("Error initiating chat:", err);
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!actData && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            No Act Selected
          </h2>
          <p className="text-gray-600 mb-4">
            Please select an act from the acts page to start chatting.
          </p>
          <button
            onClick={() => router.push("/app/acts")} // Assuming /app/acts exists, or just /app
            className="px-4 py-2 bg-[#B20F38] text-white rounded-lg hover:bg-[#8A0C2D] transition-colors"
          >
            Go to Acts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex flex-col flex-1">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (window.history.length <= 1 || window.opener) {
                    window.close();
                  } else {
                    router.back();
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[#B20F38]" />
                <div>
                  <h1 className="text-lg font-semibold text-gray-800 line-clamp-1">
                    {actData?.title || "Loading..."}
                  </h1>
                  {actData?.status && (
                    <p className="text-xs text-gray-500">{actData.status}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {actData?.pdfUrl && (
                <button
                  onClick={() => window.open(actData.pdfUrl, "_blank")}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">View PDF</span>
                </button>
              )}
              <button
                onClick={() => setShowSummary(!showSummary)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  showSummary
                    ? "bg-[#B20D38] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <BarChart3 size={18} />
                <span className="hidden sm:inline text-sm">Summary</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-[#B20F38] animate-spin mx-auto mb-2" />
                <p className="text-gray-600">Loading act data...</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={message._id || `message-${index}-${message.timestamp}`}
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-3 ${
                      message.sender === "user"
                        ? "bg-[#B20F38] text-white"
                        : message.isError
                        ? "bg-red-50 text-red-800 border border-red-200"
                        : "bg-white text-gray-800 border border-gray-200"
                    }`}
                  >
                    <div
                      className={`chat-markdown ${
                        message.sender === "user" ? "user-message" : ""
                      }`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                      >
                        {message.text}
                      </ReactMarkdown>
                    </div>
                    <div
                      className={`text-xs mt-2 ${
                        message.sender === "user"
                          ? "text-white/70"
                          : "text-gray-500"
                      }`}
                    >
                      {message.timestamp}
                    </div>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-800 border border-gray-200 rounded-lg px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-[#B20F38]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {!isLoading && (
          <div className="bg-gradient-to-r from-gray-50 to-white border-t border-gray-200">
            <button
              onClick={() => {
                const newState = !showSuggestions;
                setShowSuggestions(newState);

                if (
                  newState &&
                  suggestedQuestions.length === 0 &&
                  !generatingSuggestions
                ) {
                  generateSuggestedQuestions();
                }
              }}
              className="w-full flex items-center justify-between px-6 py-3 hover:bg-white/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Suggested Questions
                </span>
                {generatingSuggestions && (
                  <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                )}
              </div>
              {showSuggestions ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showSuggestions &&
              (suggestedQuestions.length > 0 || generatingSuggestions) && (
                <div className="px-6 pb-3">
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
                    {generatingSuggestions ? (
                      <>
                        {[
                          { width: "w-72", delay: "0ms" },
                          { width: "w-64", delay: "150ms" },
                          { width: "w-80", delay: "300ms" },
                        ].map((item, i) => (
                          <div
                            key={i}
                            className={`flex-shrink-0 ${item.width} bg-white border border-gray-200 rounded-lg p-3 animate-pulse`}
                            style={{ animationDelay: item.delay }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-gray-200 rounded"></div>
                              <div className="flex-1 space-y-2">
                                <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-100 rounded w-full"></div>
                                <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-100 rounded w-3/4"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      suggestedQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setInputMessage(question);
                            textareaRef.current?.focus();
                          }}
                          disabled={isSending}
                          className="group text-left flex-shrink-0 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-[#B20F38] hover:bg-[#FFF5F7] transition-all text-sm text-gray-700 hover:text-[#B20F38] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-xs opacity-50 group-hover:opacity-100">
                              💬
                            </span>
                            <span className="max-w-xs truncate">
                              {question}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-end space-x-3">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask anything about this act..."
              disabled={isLoading || isSending}
              className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#B20F38] focus:ring-1 focus:ring-[#B20F38] disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || isSending}
              className="px-6 py-3 bg-[#B20F38] text-white rounded-lg hover:bg-[#8A0C2D] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>

      {showSummary && (
        <div className="fixed md:static right-0 top-0 w-80 md:w-96 h-full bg-white border-l border-gray-200 flex flex-col z-20 shadow-lg animate-slide-in">
          <div className="px-6 py-4 bg-[#B20F38] flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <BarChart3 size={20} className="text-white" />
              <h3 className="text-lg font-semibold text-white">Act Summary</h3>
            </div>
            <button
              onClick={() => setShowSummary(false)}
              className="text-white hover:text-gray-200 transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Loader2 className="w-6 h-6 text-[#B20F38] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Loading summary...</p>
                </div>
              </div>
            ) : summary ? (
              <>
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 border border-red-100">
                  <div className="chat-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {summary}
                    </ReactMarkdown>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">
                  Act summary will appear here once processed.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <Loader2 className="w-8 h-8 text-[#B20F38] animate-spin" />
        </div>
      }
    >
      <ActChatContent />
    </Suspense>
  );
}
