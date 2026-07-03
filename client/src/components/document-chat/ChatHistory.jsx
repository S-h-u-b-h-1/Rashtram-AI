import { Sparkles } from "lucide-react";
import { ChatMessage } from "./ChatMessage";

export function ChatHistory({ messages, messagesEndRef, onFeedback }) {
  if (!messages.length) {
    return (
      <div className="grid min-h-full place-items-center py-14 text-center">
        <div>
          <Sparkles className="mx-auto h-7 w-7 text-[#a85a52]" />
          <p className="mt-3 font-serif text-2xl text-[#8f1d2c]">
            Begin an evidence-grounded research thread
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#706a61]">
            Ask about provisions, legal effect, implementation, affected
            institutions, timelines, or related documents.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {messages.map((message, index) => (
        <ChatMessage
          key={message._id || message.id || `${message.sender}-${index}`}
          message={message}
          onFeedback={onFeedback}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
