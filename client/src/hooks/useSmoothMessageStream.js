"use client";

import { useCallback, useEffect, useRef } from "react";

const INTERRUPTED_MESSAGE =
  "Response generation was interrupted. Please try again.";

export function useSmoothMessageStream(setMessages, flushInterval = 45) {
  const pendingRef = useRef("");
  const fullTextRef = useRef("");
  const timerRef = useRef(null);
  const streamIdRef = useRef(null);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    const streamId = streamIdRef.current;
    pendingRef.current = "";
    if (!pending || !streamId) return;
    setMessages((current) =>
      current.map((message) =>
        message.id === streamId
          ? {
              ...message,
              text: `${message.text || ""}${pending}`,
              streamPhase: "answering",
            }
          : message,
      ),
    );
  }, [setMessages]);

  const start = useCallback((streamId) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = "";
    fullTextRef.current = "";
    streamIdRef.current = streamId;
  }, []);

  const append = useCallback(
    (streamId, chunk) => {
      if (!chunk || streamIdRef.current !== streamId) return;
      fullTextRef.current += chunk;
      pendingRef.current += chunk;
      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, flushInterval);
      }
    },
    [flush, flushInterval],
  );

  const complete = useCallback(
    (streamId, { response, sources = [], metadata = {} }) => {
      if (streamIdRef.current !== streamId) return;
      flush();
      const finalText = response || fullTextRef.current;
      setMessages((current) =>
        current.map((message) =>
          message.id === streamId
            ? {
                ...message,
                text: finalText,
                sources,
                metadata,
                isStreaming: false,
                streamPhase: "complete",
              }
            : message,
        ),
      );
      streamIdRef.current = null;
    },
    [flush, setMessages],
  );

  const fail = useCallback(
    (streamId, { stopped = false } = {}) => {
      if (streamIdRef.current !== streamId) return;
      flush();
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== streamId) return message;
          const status = stopped ? "Generation stopped." : INTERRUPTED_MESSAGE;
          return {
            ...message,
            text: message.text
              ? `${message.text}\n\n_${status}_`
              : status,
            isStreaming: false,
            streamPhase: stopped ? "stopped" : "interrupted",
            isError: !stopped,
          };
        }),
      );
      streamIdRef.current = null;
    },
    [flush, setMessages],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { append, complete, fail, flush, start };
}

