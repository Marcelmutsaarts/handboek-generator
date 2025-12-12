import { NextRequest } from 'next/server';
import { buildPrompt, buildPromptWithContext } from '@/lib/prompts';
import { FormData, TemplateSection } from '@/types';
import { parseSSEStream, fallbackToJSON, extractErrorMessage, sanitizeHtmlToMarkdown } from '@/lib/sse';
import { OPENROUTER_TEXT_TIMEOUT_MS, createTimeoutController, logTimeoutAbort } from '@/lib/apiLimits';
import { estimateMaxTokens, explainTokenBudget } from '@/lib/tokenBudget';

// CRITICAL: Vercel serverless timeout - must be literal number (Next.js 16+ requirement)
// Without this, Vercel uses default 10s timeout causing truncation!
export const maxDuration = 120;

// :online suffix enables OpenRouter web search (via Exa) for real sources
// To disable: remove ':online' suffix
const MODEL = 'google/gemini-3-pro-preview:online';

// Get API key from request header (user's key) - no fallback to env
function getApiKey(request: NextRequest): string | null {
  return request.headers.get('X-OpenRouter-Key');
}

interface EerderHoofdstuk {
  titel: string;
  onderwerp: string;
  samenvatting?: string;
}

interface RequestBody {
  formData?: FormData;
  eerdereHoofdstukken?: EerderHoofdstuk[];
  // Legacy support: formData fields directly on body
  onderwerp?: string;
  niveau?: string;
  leerjaar?: number;
  leerdoelen?: string;
  lengte?: string;
  woordenAantal?: number;
  metAfbeeldingen?: boolean;
  afbeeldingType?: string;
  laatstePlaatjeInfographic?: boolean;
  metBronnen?: boolean;
  context?: string;
  template?: string;
  customSecties?: TemplateSection[];
}

export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key is vereist. Stel je OpenRouter API key in via de instellingen.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await request.json();

    // Support both new format (with formData wrapper) and legacy format
    const formData: FormData = body.formData || {
      onderwerp: body.onderwerp || '',
      niveau: body.niveau as FormData['niveau'] || 'havo',
      leerjaar: body.leerjaar || 1,
      leerdoelen: body.leerdoelen || '',
      lengte: body.lengte as FormData['lengte'] || 'medium',
      woordenAantal: body.woordenAantal || 1500,
      metAfbeeldingen: body.metAfbeeldingen ?? true,
      afbeeldingType: body.afbeeldingType as FormData['afbeeldingType'] || 'stock',
      laatstePlaatjeInfographic: body.laatstePlaatjeInfographic ?? false,
      metBronnen: body.metBronnen ?? false,
      context: body.context || '',
      template: body.template as FormData['template'] || 'klassiek',
      customSecties: body.customSecties,
    };

    const eerdereHoofdstukken = body.eerdereHoofdstukken || [];

    if (!formData.onderwerp?.trim()) {
      return new Response(JSON.stringify({ error: 'Onderwerp is verplicht' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Use context-aware prompt if there are earlier chapters
    const prompt = eerdereHoofdstukken.length > 0
      ? buildPromptWithContext(formData, eerdereHoofdstukken)
      : buildPrompt(formData);

    // Estimate max_tokens dynamically based on request parameters
    const maxTokens = estimateMaxTokens(formData, eerdereHoofdstukken.length);

    // Log token budget decision in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Generate] Token budget:', explainTokenBudget(maxTokens, formData));
    }

    // Create streaming response via OpenRouter with timeout
    const controller = createTimeoutController(OPENROUTER_TEXT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://handboek-generator.app',
          'X-Title': 'Handboek Generator',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: maxTokens,
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logTimeoutAbort('generate', OPENROUTER_TEXT_TIMEOUT_MS);
        return new Response(JSON.stringify({ error: 'Generatie duurde te lang. Probeer het opnieuw.' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }

    // Log response status for observability (no secrets)
    console.log('OpenRouter response:', {
      status: response.status,
      statusText: response.statusText,
      model: MODEL
    });

    if (!response.ok) {
      const errorMsg = await extractErrorMessage(response);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const reader = response.body?.getReader();
    if (!reader) {
      // Fallback: Try to get content from JSON body
      const fallbackContent = await fallbackToJSON(response);
      if (fallbackContent) {
        console.log('Fallback: Got content from JSON body');
        return new Response(JSON.stringify({ content: fallbackContent }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error('No response body');
    }

    const encoder = new TextEncoder();

    // Use robust SSE parsing with proper event boundary handling
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // First, send the prompt as metadata (unchanged for frontend compatibility)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'prompt', content: prompt })}\n\n`)
          );

          let streamFailed = false;
          let collectedContent = '';

          // Buffer for handling HTML tags split across chunks
          let htmlTagBuffer = '';

          // Parse SSE stream robustly using eventsource-parser
          const result = await parseSSEStream(
            reader,
            (message) => {
              // Forward messages to client in same format (frontend compatibility)
              if (message.type === 'content' && message.content) {
                // Combine with buffer and sanitize
                let content = htmlTagBuffer + message.content;
                htmlTagBuffer = '';

                // Check for incomplete HTML tags at the end
                const lastOpenBracket = content.lastIndexOf('<');
                const lastCloseBracket = content.lastIndexOf('>');
                if (lastOpenBracket > lastCloseBracket) {
                  // Incomplete tag - buffer it for next chunk
                  htmlTagBuffer = content.slice(lastOpenBracket);
                  content = content.slice(0, lastOpenBracket);
                }

                // Sanitize HTML to Markdown
                const sanitizedContent = sanitizeHtmlToMarkdown(content);

                collectedContent += sanitizedContent;
                if (sanitizedContent) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'content', content: sanitizedContent })}\n\n`
                    )
                  );
                }
              } else if (message.type === 'error' && message.error) {
                streamFailed = true;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'error', error: message.error })}\n\n`
                  )
                );
              }
            },
            (error) => {
              console.error('SSE parse error:', error.message);
              streamFailed = true;
            }
          );

          // Flush any remaining buffered content
          if (htmlTagBuffer) {
            const sanitizedBuffer = sanitizeHtmlToMarkdown(htmlTagBuffer);
            collectedContent += sanitizedBuffer;
            if (sanitizedBuffer) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'content', content: sanitizedBuffer })}\n\n`
                )
              );
            }
          }

          // Fallback: If streaming failed but we got no content, try JSON
          if (streamFailed && !collectedContent) {
            console.log('Stream failed, attempting fallback to JSON...');
            const fallbackContent = await fallbackToJSON(response);
            if (fallbackContent) {
              console.log('Fallback successful, got content from JSON');
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'content', content: fallbackContent })}\n\n`
                )
              );
            }
          }

          // Signal completion (unchanged for frontend compatibility)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          );
          controller.close();

        } catch (error) {
          console.error('Stream processing error:', error);
          // Try to send error to client
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', error: 'Stream processing failed' })}\n\n`
              )
            );
            controller.close();
          } catch {
            // If we can't send error, just close
            controller.close();
          }
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Er ging iets mis bij het genereren' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
