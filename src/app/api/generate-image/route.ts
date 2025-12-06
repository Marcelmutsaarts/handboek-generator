import { NextRequest, NextResponse } from 'next/server';

const IMAGE_MODEL = 'google/gemini-2.5-flash-image-preview';
const INFOGRAPHIC_MODEL = 'google/gemini-3-pro-image-preview';

// Get API key from request header (user's key) - no fallback to env
function getApiKey(request: NextRequest): string | null {
  return request.headers.get('X-OpenRouter-Key');
}

interface ImageResponse {
  type: string;
  image_url: {
    url: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, onderwerp, isInfographic, chapterContent }: {
      prompt: string;
      onderwerp: string;
      isInfographic?: boolean;
      chapterContent?: string;
    } = await request.json();

    // Get API key from header
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is vereist. Stel je OpenRouter API key in via de instellingen.' }, { status: 401 });
    }

    console.log('=== Image Generation Request ===');
    console.log('isInfographic:', isInfographic);
    console.log('hasChapterContent:', !!chapterContent);
    console.log('chapterContentLength:', chapterContent?.length || 0);
    console.log('onderwerp:', onderwerp);

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Create different prompts based on whether it's an infographic or regular image
    let imagePrompt: string;
    let selectedModel: string;

    if (isInfographic && chapterContent) {
      selectedModel = INFOGRAPHIC_MODEL;

      // Use the full chapter content for comprehensive infographic generation
      imagePrompt = `Maak een gedetailleerde, professionele INFOGRAPHIC die de kernconcepten van dit hoofdstuk samenvat.

=== VOLLEDIGE HOOFDSTUKINHOUD ===
${chapterContent}
=== EINDE INHOUD ===

INFOGRAPHIC VEREISTEN:
1. STRUCTUUR & LAYOUT:
   - Centrale titel bovenaan met het hoofdonderwerp: "${onderwerp}"
   - Verdeel de infographic in 4-6 duidelijke secties
   - Gebruik een logische flow van boven naar beneden of van links naar rechts
   - Maak een visuele hiërarchie: hoofdconcepten groot, details kleiner

2. VISUELE ELEMENTEN (BELANGRIJK - maak deze rijk en gedetailleerd):
   - Iconografie: Gebruik minimaal 8-12 relevante iconen die concepten verbeelden
   - Diagrammen: Voeg minstens 1-2 flowcharts, mindmaps of procesdiagrammen toe
   - Illustraties: Kleine tekeningen die kernbegrippen uitbeelden
   - Pijlen en verbindingslijnen om relaties tussen concepten te tonen

3. DATA VISUALISATIE:
   - Als er getallen/statistieken in de tekst staan: maak grafieken, taartdiagrammen of staafdiagrammen
   - Gebruik percentages, cijfers en feiten prominent in het ontwerp
   - Timeline als er een chronologisch aspect is

4. TEKSTUELE ELEMENTEN:
   - Korte, puntige teksten (max 5-7 woorden per tekstblok)
   - Highlight boxes voor kernbegrippen met definities
   - Bullet points voor lijsten
   - Citaten of belangrijke uitspraken in kaders

5. KLEURENSCHEMA:
   - Gebruik een harmonieus palet van 3-4 kleuren
   - Educatieve tinten: diepe blauwtinten, warme groen, of professioneel paars/oranje
   - Witte ruimte voor leesbaarheid
   - Contrasterende kleuren voor nadruk

6. STIJL:
   - Modern, strak infographic design zoals je zou zien in een professioneel lesboek
   - Hoge kwaliteit, geschikt voor afdrukken op A3 formaat
   - Geen watermerken of logo's
   - Professioneel en educatief van uitstraling

BELANGRIJK: Dit moet eruitzien als een premium educatieve poster die je in een klaslokaal zou ophangen. Maak het informatiedicht maar overzichtelijk en visueel aantrekkelijk.`;
    } else {
      selectedModel = IMAGE_MODEL;
      imagePrompt = `Genereer een professionele, educatieve foto of illustratie voor een lesboek hoofdstuk over "${onderwerp}".

De afbeelding moet het volgende tonen: ${prompt}

Stijlvereisten:
- Fotorealistisch of hoogwaardige illustratie
- Geschikt voor educatief materiaal
- Helder, goed belicht, professionele uitstraling
- Geen tekst overlays of watermerken
- Boeiend en relevant voor het onderwerp`;
    }

    // Use 1:1 aspect ratio for infographics (poster format), 16:9 for regular images
    const aspectRatio = isInfographic ? '1:1' : '16:9';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://handboek-generator.app',
        'X-Title': 'Handboek Generator',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: 'user',
            content: imagePrompt,
          },
        ],
        modalities: ['image', 'text'],
        image_config: {
          aspect_ratio: aspectRatio,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter image generation error:', error);
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    // Check for images in the response
    if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
      const imageData = message.images[0] as ImageResponse;
      if (imageData.image_url?.url) {
        return NextResponse.json({
          imageUrl: imageData.image_url.url,
          alt: prompt
        });
      }
    }

    // If no image found in response
    console.error('No image in response:', JSON.stringify(data, null, 2));
    return NextResponse.json({ error: 'No image generated' }, { status: 500 });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
  }
}
