/**
 * Robust SSE (Server-Sent Events) parsing utilities
 *
 * This module provides safe parsing of SSE streams that handles:
 * - Chunk boundaries splitting events/JSON
 * - Malformed events
 * - Provider variations in SSE format
 * - Fallback to JSON when streaming fails
 *
 * Why this is safer than naive line-splitting:
 * - SSE events are separated by \n\n, not \n (buffer.split('\n') breaks across chunks)
 * - JSON can be split across multiple TCP chunks
 * - eventsource-parser handles proper event boundary detection
 * - Fallback ensures we get content even if streaming parser fails
 */

import { createParser, EventSourceMessage, ParseError } from 'eventsource-parser';

export interface SSEMessage {
  type: 'content' | 'error' | 'done';
  content?: string;
  error?: string;
}

/**
 * Parse an SSE stream from OpenRouter/LLM providers robustly
 *
 * @param reader ReadableStream reader from fetch response
 * @param onMessage Callback for each parsed message
 * @param onError Optional error handler
 * @returns Promise that resolves when stream is complete
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onMessage: (message: SSEMessage) => void,
  onError?: (error: Error) => void
): Promise<{ success: boolean; fullContent?: string }> {
  const decoder = new TextDecoder();
  let fullContent = '';
  let hadError = false;

  try {
    const parser = createParser({
      onEvent: (event: EventSourceMessage) => {
        const data = event.data;

        // OpenRouter sends [DONE] to signal completion
        if (data === '[DONE]') {
          onMessage({ type: 'done' });
          return;
        }

        try {
          const parsed = JSON.parse(data);

          // Extract content from OpenRouter/OpenAI format
          const content = parsed.choices?.[0]?.delta?.content ||
                         parsed.choices?.[0]?.message?.content;

          if (content) {
            fullContent += content;
            onMessage({ type: 'content', content });
          }

          // Check for errors in response
          if (parsed.error) {
            const errorMsg = parsed.error.message || 'Unknown API error';
            hadError = true;
            onMessage({ type: 'error', error: errorMsg });
            if (onError) onError(new Error(errorMsg));
          }
        } catch (parseError) {
          // Silently ignore malformed JSON in individual events
          // (some providers send non-JSON control messages)
          console.warn('SSE parse warning:', parseError);
        }
      },
      onError: (error: ParseError) => {
        // Handle parse errors
        console.warn('SSE parser error:', error.message);
      }
    });

    // Read stream chunks and feed to parser
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Decode chunk and feed to parser
      // Parser handles buffering and event boundary detection
      const chunk = decoder.decode(value, { stream: true });
      parser.feed(chunk);
    }

    return { success: !hadError, fullContent };

  } catch (error) {
    console.error('SSE stream error:', error);
    if (onError) {
      onError(error instanceof Error ? error : new Error('SSE parsing failed'));
    }
    return { success: false, fullContent };
  }
}

/**
 * Fallback: Try to read entire response as JSON if streaming fails
 *
 * Some providers may return non-streaming JSON on errors or for short responses
 *
 * @param response Fetch response object
 * @returns Extracted content or null
 */
export async function fallbackToJSON(response: Response): Promise<string | null> {
  try {
    // Clone response so we can try reading it again
    const clonedResponse = response.clone();
    const text = await clonedResponse.text();

    try {
      const json = JSON.parse(text);

      // Try to extract content from various response formats
      const content =
        json.choices?.[0]?.message?.content ||  // Non-streaming OpenAI format
        json.choices?.[0]?.text ||               // Legacy format
        json.content ||                          // Direct content
        json.message;                            // Error message

      return content || null;
    } catch {
      // Not valid JSON, return raw text if it looks like content
      return text && text.length < 10000 ? text : null;
    }
  } catch (error) {
    console.error('Fallback JSON parse failed:', error);
    return null;
  }
}

/**
 * Extract error message from OpenRouter/API error response
 *
 * @param response Fetch response with error
 * @returns Human-readable error message
 */
export async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();

    try {
      const json = JSON.parse(text);

      // Try various error message locations
      const errorMsg =
        json.error?.message ||
        json.error ||
        json.message ||
        'API request failed';

      // Log for observability (no secrets)
      console.error('API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorMsg
      });

      return typeof errorMsg === 'string' ? errorMsg : 'API request failed';
    } catch {
      // Not JSON, return status text
      return `API error: ${response.status} ${response.statusText}`;
    }
  } catch {
    return `API error: ${response.status}`;
  }
}

/**
 * Test helper: Simulate chunked SSE data for testing parser robustness
 *
 * Tests that the parser handles:
 * - JSON split across chunks
 * - Events split across chunks
 * - Malformed events
 */
export function* generateChunkedSSE(content: string): Generator<string> {
  // Simulate realistic chunking that splits JSON and events
  const tokens = content.split(' ');

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Create SSE event with this token
    const event = `data: ${JSON.stringify({
      choices: [{ delta: { content: token + ' ' } }]
    })}\n\n`;

    // Split the event across multiple chunks (worst case)
    if (i % 3 === 0 && event.length > 10) {
      const mid = Math.floor(event.length / 2);
      yield event.slice(0, mid);  // First half
      yield event.slice(mid);     // Second half
    } else {
      yield event;  // Full event
    }
  }

  // Send completion
  yield 'data: [DONE]\n\n';
}
