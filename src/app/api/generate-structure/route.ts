import { NextRequest, NextResponse } from 'next/server';
import { Niveau, HoofdstukPlan } from '@/types';

const MODEL = 'google/gemini-3-pro-preview';

// Get API key from request header (user's key) - no fallback to env
function getApiKey(request: NextRequest): string | null {
  return request.headers.get('X-OpenRouter-Key');
}

interface GenerateStructureRequest {
  titel: string;
  beschrijving: string;
  niveau: Niveau;
  leerjaar: number;
  aantalHoofdstukken?: number; // Optioneel, AI bepaalt anders zelf
}

const NIVEAU_CONTEXT: Record<Niveau, string> = {
  vmbo: 'vmbo-leerlingen (12-16 jaar), praktisch en toegankelijk',
  havo: 'havo-leerlingen (12-17 jaar), gebalanceerd theoretisch en praktisch',
  vwo: 'vwo-leerlingen (12-18 jaar), diepgaand en academisch voorbereidend',
  mbo: 'mbo-studenten (16-25 jaar), beroepsgericht en praktisch',
  hbo: 'hbo-studenten (18+ jaar), professioneel en toegepast',
  uni: 'universitaire studenten (18+ jaar), wetenschappelijk en theoretisch',
};

export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = getApiKey(request);
    console.log('=== Generate Structure Request ===');
    console.log('Has API key:', !!apiKey);
    console.log('API key length:', apiKey?.length || 0);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is vereist. Stel je OpenRouter API key in via de instellingen.' },
        { status: 401 }
      );
    }

    const body: GenerateStructureRequest = await request.json();
    const { titel, beschrijving, niveau, leerjaar, aantalHoofdstukken } = body;

    if (!titel?.trim() || !beschrijving?.trim()) {
      return NextResponse.json(
        { error: 'Titel en beschrijving zijn verplicht' },
        { status: 400 }
      );
    }

    const aantalInstructie = aantalHoofdstukken
      ? `Maak precies ${aantalHoofdstukken} hoofdstukken.`
      : 'Bepaal zelf het optimale aantal hoofdstukken (meestal 6-12) op basis van de scope.';

    const prompt = `Je bent een ervaren curriculum-ontwerper. Genereer een logische hoofdstukindeling voor een educatief handboek.

## HANDBOEK INFORMATIE
Titel: ${titel}
Beschrijving/Scope: ${beschrijving}
Doelgroep: ${NIVEAU_CONTEXT[niveau]}, leerjaar ${leerjaar}

## INSTRUCTIES
${aantalInstructie}

Voor elk hoofdstuk geef je:
1. Een duidelijke titel (Nederlandse schrijfwijze: alleen eerste woord met hoofdletter)
2. Een korte beschrijving (1-2 zinnen) van wat het hoofdstuk behandelt
3. Optioneel: 2-4 paragraaftitels als het hoofdstuk duidelijk onder te verdelen is

## VEREISTEN
- Logische opbouw van eenvoudig naar complex
- Elk hoofdstuk bouwt voort op vorige kennis
- Passend bij het niveau en leerjaar
- Praktische toepasbaarheid waar relevant

## OUTPUT FORMAT
Geef je antwoord als een JSON array. Geen andere tekst, alleen de JSON:
[
  {
    "titel": "Hoofdstuktitel",
    "beschrijving": "Korte beschrijving van de inhoud",
    "paragrafen": ["Paragraaf 1", "Paragraaf 2"]
  }
]

Zorg dat de JSON geldig is en direct te parsen.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', response.status, errorText);
      // Return the actual error from OpenRouter for debugging
      let errorMessage = 'Structuur generatie mislukt';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default message
      }
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'Geen response ontvangen' }, { status: 500 });
    }

    // Parse de JSON uit de response
    let hoofdstukken: Array<{ titel: string; beschrijving: string; paragrafen?: string[] }>;

    try {
      // Probeer de JSON te extraheren (soms zit er tekst omheen)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        hoofdstukken = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Geen JSON array gevonden');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      return NextResponse.json({ error: 'Kon structuur niet verwerken' }, { status: 500 });
    }

    // Converteer naar HoofdstukPlan format met unieke IDs
    const structuur: HoofdstukPlan[] = hoofdstukken.map((h, index) => ({
      id: `plan-${Date.now()}-${index}`,
      titel: h.titel,
      beschrijving: h.beschrijving,
      paragrafen: h.paragrafen,
      status: 'pending' as const,
    }));

    return NextResponse.json({ structuur });

  } catch (error) {
    console.error('Generate structure error:', error);
    return NextResponse.json(
      { error: 'Er ging iets mis bij het genereren van de structuur' },
      { status: 500 }
    );
  }
}
