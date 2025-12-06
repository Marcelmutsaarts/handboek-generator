import { NextRequest } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'google/gemini-3-pro-preview';

interface RewriteRequest {
  sectie: string;        // De originele tekst van de sectie
  instructie: string;    // Wat moet er gebeuren (bijv. "maak eenvoudiger")
  context?: string;      // Optionele context (onderwerp, niveau, etc.)
}

export async function POST(request: NextRequest) {
  try {
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
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
    });

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
