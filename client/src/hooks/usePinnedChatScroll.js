"use client";

import { useCallback, useEffect, useRef } from "react";

export function usePinnedChatScroll(messages) {
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pinnedRef = useRef(true);

  const pinToLatest = useCallback(() => {
    pinnedRef.current = true;
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    pinnedRef.current = distanceFromBottom < 120;
  }, []);

  useEffect(() => {
    if (!pinnedRef.current) return;
    const frame = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages]);

  return {
    handleScroll,
    messagesEndRef,
    pinToLatest,
    scrollContainerRef,
  };
}
