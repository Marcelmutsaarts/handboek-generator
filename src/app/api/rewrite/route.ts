import { NextRequest } from 'next/server';
import { OPENROUTER_REWRITE_TIMEOUT_MS, createTimeoutController, logTimeoutAbort } from '@/lib/apiLimits';

const MODEL = 'google/gemini-3-pro-preview';

// Get API key from request header (user's key) - no fallback to env
function getApiKey(request: NextRequest): string | null {
  return request.headers.get('X-OpenRouter-Key');
}

interface RewriteRequest {
  sectie: string;        // De originele tekst van de sectie
  instructie: string;    // Wat moet er gebeuren (bijv. "maak eenvoudiger")
  context?: string;      // Optionele context (onderwerp, niveau, etc.)
}

export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key is vereist. Stel je OpenRouter API key in via de instellingen.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body: RewriteRequest = await request.json();

    if (!body.sectie?.trim() || !body.instructie?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Sectie en instructie zijn verplicht' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `Je bent een ervaren onderwijsredacteur. Je taak is om de onderstaande tekst te herschrijven volgens de gegeven instructie.

INSTRUCTIE: ${body.instructie}

${body.context ? `CONTEXT: ${body.context}\n\n` : ''}ORIGINELE TEKST:
${body.sectie}

BELANGRIJKE REGELS:
- Behoud de markdown opmaak (headers, lijsten, etc.)
- Behoud de structuur en secties
- Pas alleen de inhoud aan volgens de instructie
- Schrijf in het Nederlands
- Als er [AFBEELDING: ...] placeholders zijn, behoud deze exact

Geef alleen de herschreven tekst terug, zonder uitleg of commentaar.`;

    // Add timeout for rewrite requests
    const controller = createTimeoutController(OPENROUTER_REWRITE_TIMEOUT_MS);

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
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logTimeoutAbort('rewrite', OPENROUTER_REWRITE_TIMEOUT_MS);
        return new Response(
          JSON.stringify({ error: 'Herschrijven duurde te lang. Probeer het opnieuw.' }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter error:', error);
      throw new Error('API request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`)
                  );
                }
              } catch {
                // Ignore parsing errors
              }
            }
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        );
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Rewrite error:', error);
    return new Response(
      JSON.stringify({ error: 'Er ging iets mis bij het herschrijven' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
