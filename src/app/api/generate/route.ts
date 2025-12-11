import { NextRequest } from 'next/server';
import { buildPrompt, buildPromptWithContext } from '@/lib/prompts';
import { FormData, TemplateSection } from '@/types';

const MODEL = 'google/gemini-3-pro-preview';

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
      laatstePlaatjeInfographic: false,
      metBronnen: false,
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

    // Create streaming response via OpenRouter with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout for text generation

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
          max_tokens: 8192,
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'Generatie duurde te lang. Probeer het opnieuw.' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }
    clearTimeout(timeoutId);

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
        // First, send the prompt as metadata
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'prompt', content: prompt })}\n\n`)
        );

        // Process the stream
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
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'content', content })}\n\n`
                    )
                  );
                }
              } catch {
                // Ignore parsing errors
              }
            }
          }
        }

        // Signal completion
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
