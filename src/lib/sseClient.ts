/**
 * Client-side SSE (Server-Sent Events) consumption helper.
 *
 * Why this exists:
 * - fetch() streams can split SSE events/JSON across arbitrary chunks
 * - naive `chunk.split('\n')` + `JSON.parse` drops trailing content, often at the end
 *
 * This helper buffers by the SSE event delimiter (`\n\n`) and only parses complete events.
 */
export type SSEClientHandler = (data: any) => void;

export async function consumeSSEFromReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onData: SSEClientHandler
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE events. SSE events are delimited by a blank line.
    while (true) {
      const sepIndex = buffer.indexOf('\n\n');
      if (sepIndex === -1) break;

      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      // Collect all data: lines (SSE allows multiple data lines per event).
      const dataLines: string[] = [];
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('data:')) {
          // "data:" or "data: " are both valid
          const after = line.slice(5);
          dataLines.push(after.startsWith(' ') ? after.slice(1) : after);
        }
      }

      if (dataLines.length === 0) continue;
      const dataStr = dataLines.join('\n');

      // OpenRouter/OpenAI streaming completion marker (server-side parser may not forward it)
      if (dataStr === '[DONE]') continue;

      try {
        onData(JSON.parse(dataStr));
      } catch {
        // Ignore malformed events (some providers send keep-alives/comments)
      }
    }
  }
}


