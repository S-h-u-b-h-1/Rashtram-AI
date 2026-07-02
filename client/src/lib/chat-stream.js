export const consumeSSEStream = async (
  response,
  { onEvent, signal } = {},
) => {
  if (!response.body) {
    throw new Error("The response stream is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const processEvent = (rawEvent) => {
    const data = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    if (data === "[DONE]") {
      completed = true;
      return;
    }
    const event = JSON.parse(data);
    if (event.type === "done") completed = true;
    onEvent?.(event);
  };

  try {
    while (!completed) {
      if (signal?.aborted) {
        throw new DOMException("Generation stopped.", "AbortError");
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      events.forEach(processEvent);
    }
    buffer += decoder.decode();
    if (buffer.trim() && !completed) processEvent(buffer);
    if (!completed) {
      throw new Error("The response stream ended before completion.");
    }
  } finally {
    reader.releaseLock();
  }
};

