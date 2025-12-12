import { NextRequest, NextResponse } from 'next/server';
import { OPENROUTER_SOURCES_TIMEOUT_MS, createTimeoutController, logTimeoutAbort } from '@/lib/apiLimits';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface RegenerateSourcesRequest {
  content: string;
  onderwerp: string;
  niveau: string;
  leerjaar: number;
  context?: string;
}

const MODEL = 'google/gemini-3-pro-preview';

function getApiKey(request: NextRequest): string | null {
  return request.headers.get('X-OpenRouter-Key');
}

export async function POST(request: NextRequest) {
  try {
    const body: RegenerateSourcesRequest = await request.json();
    const { content, onderwerp, niveau, leerjaar, context } = body;

    if (!content?.trim() || !onderwerp?.trim()) {
      return NextResponse.json(
        { error: 'content en onderwerp zijn verplicht' },
        { status: 400 }
      );
    }

    const apiKey = getApiKey(request);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is vereist. Stel je OpenRouter API key in via de instellingen.' },
        { status: 401 }
      );
    }

    const trustedDomains = `Betrouwbare domeinen (kies hieruit):
- https://nl.wikipedia.org/wiki/[artikel]
- https://www.rijksoverheid.nl/
- https://www.cbs.nl/ of https://opendata.cbs.nl/
- https://www.kennisnet.nl/
- https://lesmateriaal.nu/
- https://nos.nl/ of https://www.nrc.nl/ of https://www.volkskrant.nl/
- https://nature.com/ of https://science.org/
`;

    const prompt = `Je krijgt een hoofdstuk waarin bronvermeldingen mogelijk onjuist zijn.

ONDERWERP: ${onderwerp}
NIVEAU: ${niveau}, leerjaar ${leerjaar}
${context ? `CONTEXT: ${context}\n` : ''}DOEL:
- Vervang foutieve of onbetrouwbare bronnen door nieuwe, verifieerbare bronnen.
- Pas zowel de inline citaties ALS de bronnenlijst aan.
- Zorg dat de tekstinhoud leunt op de nieuwe bronnen (gebruik feiten/cijfers uit die bronnen).
- Houd de structuur, koppen en [AFBEELDING: ...] markers exact gelijk.

${trustedDomains}

REGELS VOOR BRONNEN:
- Gebruik alleen bronnen die publiek toegankelijk zijn op bovenstaande domeinen.
- Kies bronnen die concreet over het onderwerp gaan (geen generieke homepages).
- Vermijd placeholders of standaard titels zoals "Agile Manifesto", "Wikipedia", "Kennisnet" zonder onderwerp.
- Inline citaties gebruiken exact dezelfde titel als in de bronnenlijst (1-op-1).
- Gebruik het format "(Titel, Jaar)" in de tekst. Als jaar onbekend is, gebruik het publicatiejaar van de pagina/artikel.
- Bronnenlijst is een inventarisatie van de inline citaties, geen nieuwe bronnen toevoegen die niet geciteerd zijn.
- Minimaal 5-8 citaties in de tekst (mag dezelfde bron meerdere keren).

WAT JE MOET TERUGGEVEN:
- De COMPLETE herschreven tekst met nieuwe bronnen, dezelfde structuur en dezelfde [AFBEELDING: ...] markers.
- Inline citaties én de ## Bronnen sectie zijn in sync en passen bij het onderwerp.

HUIDIGE TEKST:
"""
${content}
"""`;

    const controller = createTimeoutController(OPENROUTER_SOURCES_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': request.headers.get('origin') || 'https://handboek-generator.vercel.app',
          'X-Title': 'Handboek Generator',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logTimeoutAbort('regenerate-sources', OPENROUTER_SOURCES_TIMEOUT_MS);
        return NextResponse.json(
          { error: 'Bronnen regenereren duurde te lang. Probeer opnieuw.' },
          { status: 504 }
        );
      }
      throw error;
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter error (regenerate sources):', error);
      return NextResponse.json(
        { error: 'OpenRouter API error bij regenereren van bronnen' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const improvedContent = data.choices?.[0]?.message?.content;

    if (!improvedContent) {
      return NextResponse.json(
        { error: 'Geen antwoord ontvangen bij regenereren van bronnen' },
        { status: 500 }
      );
    }

    return NextResponse.json({ content: improvedContent.trim() });
  } catch (error) {
    console.error('Regenerate sources error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate sources', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
