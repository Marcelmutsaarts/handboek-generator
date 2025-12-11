import { NextRequest, NextResponse } from 'next/server';

// BELANGRIJK: NOOIT AANPASSEN - Altijd Gemini gebruiken!
const COVER_MODEL = 'google/gemini-3-pro-image-preview';

function getApiKey(request: NextRequest): string | null {
  return request.headers.get('X-OpenRouter-Key');
}

export async function POST(request: NextRequest) {
  try {
    const { titel, beschrijving, niveau, context }: {
      titel: string;
      beschrijving?: string;
      niveau: string;
      context?: string;
    } = await request.json();

    const apiKey = getApiKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is vereist' }, { status: 401 });
    }

    if (!titel) {
      return NextResponse.json({ error: 'Titel is vereist' }, { status: 400 });
    }

    // Bouw een prompt voor een professionele boekkaft
    const coverPrompt = `Ontwerp een prachtige, professionele boekkaft voor een educatief handboek.

BOEKDETAILS:
- Titel: "${titel}"
${beschrijving ? `- Onderwerp: ${beschrijving}` : ''}
- Onderwijsniveau: ${niveau}
${context ? `- Thema/context: ${context}` : ''}

ONTWERPVEREISTEN:
1. STIJL:
   - Modern, strak en professioneel ontwerp
   - Geschikt voor een educatief lesboek/handboek
   - Visueel aantrekkelijk en uitnodigend

2. COMPOSITIE:
   - Centrale focus met ruimte voor de titel bovenaan
   - Harmonieuze kleurcombinatie (2-3 hoofdkleuren)
   - Abstracte of concrete illustratie die het onderwerp verbeeldt
   - Geen tekst in de afbeelding (titel wordt er later overheen geplaatst)

3. ELEMENTEN:
   - Relevante visuele elementen die het onderwerp representeren
   - Subtiele patronen of texturen voor diepte
   - Professionele uitstraling passend bij onderwijs

4. TECHNISCH:
   - Verticaal/portret formaat (boekcover)
   - Hoge kwaliteit, geschikt voor print
   - Geen watermerken of logo's

Maak een cover die leerlingen en docenten aanspreekt en het onderwerp visueel samenvat.`;

    // Add timeout for cover generation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for image generation

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://handboek-generator.app',
        'X-Title': 'Handboek Generator',
      },
      body: JSON.stringify({
        model: COVER_MODEL,
        messages: [
          {
            role: 'user',
            content: coverPrompt,
          },
        ],
        modalities: ['image', 'text'],
        image_config: {
          aspect_ratio: '3:4', // Portret/boekformaat
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter cover generation error:', error);
      return NextResponse.json({ error: 'Cover generatie mislukt' }, { status: 500 });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    // Try various shapes OpenRouter/Gemini may return
    let imageUrl: string | undefined;

    // 1) Legacy: message.images[0].image_url.url
    if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
      imageUrl = message.images[0]?.image_url?.url;
    }

    // 2) Newer: message.content array with image_url
    if (!imageUrl && Array.isArray(message?.content)) {
      for (const part of message.content) {
        if (part?.image_url?.url) {
          imageUrl = part.image_url.url;
          break;
        }
      }
    }

    if (imageUrl) {
      return NextResponse.json({ coverUrl: imageUrl });
    }

    console.error('No cover image in response:', JSON.stringify(data, null, 2));
    return NextResponse.json({ error: 'Geen cover gegenereerd' }, { status: 500 });

  } catch (error) {
    console.error('Cover generation error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Cover generatie duurde te lang. Probeer het opnieuw.' }, { status: 504 });
    }

    return NextResponse.json({ error: 'Cover generatie mislukt' }, { status: 500 });
  }
}
