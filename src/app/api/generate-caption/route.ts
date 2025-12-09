import { NextRequest, NextResponse } from 'next/server';

const CAPTION_MODEL = 'google/gemini-2.0-flash-001';

function getApiKey(request: NextRequest): string | null {
  return request.headers.get('X-OpenRouter-Key');
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, onderwerp, imageDescription, niveau }: {
      imageUrl: string;
      onderwerp: string;
      imageDescription: string;
      niveau?: string;
    } = await request.json();

    const apiKey = getApiKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is vereist' }, { status: 401 });
    }

    if (!imageUrl || !onderwerp) {
      return NextResponse.json({ error: 'imageUrl en onderwerp zijn vereist' }, { status: 400 });
    }

    // Build prompt for caption generation
    const captionPrompt = `Je bent een ervaren educatieve tekstschrijver. Genereer een korte, informatieve caption voor een afbeelding in een educatief handboek.

CONTEXT:
- Onderwerp van het hoofdstuk: "${onderwerp}"
- Beschrijving van de afbeelding: "${imageDescription}"
${niveau ? `- Onderwijsniveau: ${niveau}` : ''}

OPDRACHT:
Schrijf een caption van 1-2 zinnen die:
1. De afbeelding direct relateert aan het onderwerp
2. Educatieve waarde toevoegt (niet alleen beschrijft wat je ziet)
3. Geschikt is voor het onderwijsniveau
4. Begint met "Afb:" gevolgd door een informatieve titel

VOORBEELD FORMATEN:
- "Afb: Schematische weergave van fotosynthese - zonlicht wordt omgezet in glucose"
- "Afb: De storming van de Bastille (1789) - symbool van de revolutie"
- "Afb: DNA-helix structuur met baseparen adenine-thymine en guanine-cytosine"

Geef ALLEEN de caption terug, zonder extra uitleg of aanhalingstekens.`;

    // Add timeout for caption generation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

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
          model: CAPTION_MODEL,
          messages: [
            {
              role: 'user',
              content: captionPrompt,
            },
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter caption generation error:', error);
      return NextResponse.json({ error: 'Caption generatie mislukt' }, { status: 500 });
    }

    const data = await response.json();
    const caption = data.choices?.[0]?.message?.content?.trim();

    if (!caption) {
      return NextResponse.json({ error: 'Geen caption gegenereerd' }, { status: 500 });
    }

    return NextResponse.json({ caption });

  } catch (error) {
    console.error('Caption generation error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Caption generatie duurde te lang' }, { status: 504 });
    }

    return NextResponse.json({ error: 'Caption generatie mislukt' }, { status: 500 });
  }
}
