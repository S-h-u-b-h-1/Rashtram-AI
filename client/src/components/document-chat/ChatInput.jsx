"use client";

import { Loader2, RotateCcw, Send, Trash2 } from "lucide-react";

export function ChatInput({
  input,
  setInput,
  sending,
  disabled,
  onSend,
  onRegenerate,
  onClear,
}) {
  return (
    <div className="border-t border-[#8f1d2c]/8 bg-[#f7f2eb] p-4">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-end gap-2 rounded-2xl border border-[#8f1d2c]/10 bg-white p-2 shadow-sm">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            disabled={disabled || sending}
            placeholder={
              disabled
                ? "Grounded chat requires a verified official PDF"
                : "Ask a grounded question about this document…"
            }
            rows={2}
            className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[#29312d] outline-none placeholder:text-[#9a9387]"
          />
          <button
            type="button"
            disabled={!input.trim() || disabled || sending}
            onClick={() => onSend()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#8f1d2c] text-white disabled:opacity-35"
            aria-label="Send research question"
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
            Answers cite retrieved passages. Verify important conclusions
            against the original record.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={disabled || sending}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#874047] disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" />
              Regenerate
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#874047]"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
