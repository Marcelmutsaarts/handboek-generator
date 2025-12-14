import { NextRequest, NextResponse } from 'next/server';
import { OPENROUTER_IMAGE_TIMEOUT_MS, OPENROUTER_CAPTION_TIMEOUT_MS, createTimeoutController, logTimeoutAbort } from '@/lib/apiLimits';

export const runtime = 'nodejs';
export const maxDuration = 90;

// Models
const IMAGE_MODEL_STANDARD = 'google/gemini-2.5-flash-image';
const IMAGE_MODEL_PRO = 'google/gemini-3-pro-image-preview';
const CAPTION_MODEL = 'google/gemini-2.0-flash-001';

function getApiKey(request: NextRequest): string | null {
  return request.headers.get('X-OpenRouter-Key');
}

interface FixImageRequest {
  action: 'fix-caption' | 'regenerate-standard' | 'regenerate-pro';
  imageUrl: string;
  currentCaption: string | null;
  currentAlt: string | null;
  onderwerp: string;
  feedback: string; // The quality feedback about this image
  niveau?: string;
}

interface ImageResponse {
  type: string;
  image_url: {
    url: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: FixImageRequest = await request.json();
    const { action, imageUrl, currentCaption, currentAlt, onderwerp, feedback, niveau } = body;

    console.log('=== Fix Image Request ===');
    console.log('action:', action);
    console.log('onderwerp:', onderwerp);
    console.log('feedback:', feedback?.substring(0, 100));

    const apiKey = getApiKey(request);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is vereist' },
        { status: 401 }
      );
    }

    if (!action || !onderwerp || !feedback) {
      return NextResponse.json(
        { error: 'Missing required fields: action, onderwerp, feedback' },
        { status: 400 }
      );
    }

    // Handle caption fix
    if (action === 'fix-caption') {
      const captionPrompt = `Je bent een educatieve tekstschrijver. Corrigeer de caption voor een afbeelding in een lesboek.

HUIDIGE SITUATIE:
- Onderwerp hoofdstuk: "${onderwerp}"
- Huidige caption: "${currentCaption || 'Geen caption'}"
- Alt tekst: "${currentAlt || 'Geen alt'}"
${niveau ? `- Onderwijsniveau: ${niveau}` : ''}

PROBLEEM (uit kwaliteitscontrole):
${feedback}

OPDRACHT:
Schrijf een VERBETERDE caption die:
1. Het probleem uit de feedback oplost
2. Correct Nederlands gebruikt (geen spelfouten)
3. Informatief en educatief is
4. Past bij het onderwerp en niveau
5. Begint met "Afb:" gevolgd door een informatieve titel

Geef ALLEEN de nieuwe caption terug, zonder extra uitleg of aanhalingstekens.`;

      const controller = createTimeoutController(OPENROUTER_CAPTION_TIMEOUT_MS);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://handboek-generator.app',
          'X-Title': 'Handboek Generator',
        },
        body: JSON.stringify({
          model: CAPTION_MODEL,
          messages: [{ role: 'user', content: captionPrompt }],
          max_tokens: 200,
          temperature: 0.5,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Caption fix error:', error);
        return NextResponse.json({ error: 'Caption correctie mislukt' }, { status: 500 });
      }

      const data = await response.json();
      const newCaption = data.choices?.[0]?.message?.content?.trim();

      if (!newCaption) {
        return NextResponse.json({ error: 'Geen caption gegenereerd' }, { status: 500 });
      }

      return NextResponse.json({
        action: 'caption-fixed',
        newCaption,
        imageUrl, // Return same image URL
      });
    }

    // Handle image regeneration
    if (action === 'regenerate-standard' || action === 'regenerate-pro') {
      const selectedModel = action === 'regenerate-pro' ? IMAGE_MODEL_PRO : IMAGE_MODEL_STANDARD;

      // First, generate a better prompt based on the feedback
      const promptGenerationPrompt = `Je bent een expert in het maken van prompts voor AI afbeelding generatie.

CONTEXT:
- Onderwerp: "${onderwerp}"
- Huidige beschrijving: "${currentAlt || currentCaption || 'Geen beschrijving'}"
${niveau ? `- Onderwijsniveau: ${niveau}` : ''}

PROBLEEM (uit kwaliteitscontrole):
${feedback}

OPDRACHT:
Genereer een VERBETERDE Engelse prompt voor een afbeelding die:
1. Het probleem uit de feedback oplost
2. Past bij het onderwerp "${onderwerp}"
3. Geschikt is voor educatief materiaal
4. Specifiek en beschrijvend is (2-3 zinnen)

Geef ALLEEN de Engelse prompt terug, zonder extra uitleg.`;

      // Get improved prompt
      const promptController = createTimeoutController(OPENROUTER_CAPTION_TIMEOUT_MS);

      const promptResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://handboek-generator.app',
        },
        body: JSON.stringify({
          model: CAPTION_MODEL,
          messages: [{ role: 'user', content: promptGenerationPrompt }],
          max_tokens: 150,
          temperature: 0.7,
        }),
        signal: promptController.signal,
      });

      if (!promptResponse.ok) {
        return NextResponse.json({ error: 'Kon geen verbeterde prompt genereren' }, { status: 500 });
      }

      const promptData = await promptResponse.json();
      const improvedPrompt = promptData.choices?.[0]?.message?.content?.trim();

      if (!improvedPrompt) {
        return NextResponse.json({ error: 'Geen prompt gegenereerd' }, { status: 500 });
      }

      // Now generate the image
      const imagePrompt = `Generate a professional, educational image for a textbook chapter about "${onderwerp}".

The image should show: ${improvedPrompt}

Style requirements:
- Photorealistic or high-quality illustration
- Suitable for educational material
- Clear, well-lit, professional appearance
- No text overlays or watermarks
- Engaging and relevant to the topic`;

      const imageController = createTimeoutController(OPENROUTER_IMAGE_TIMEOUT_MS);

      const imageResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://handboek-generator.app',
          'X-Title': 'Handboek Generator',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: imagePrompt }],
          modalities: ['image', 'text'],
          image_config: {
            aspect_ratio: '16:9',
          },
        }),
        signal: imageController.signal,
      });

      if (!imageResponse.ok) {
        const error = await imageResponse.text();
        console.error('Image regeneration error:', error);
        return NextResponse.json({ error: 'Afbeelding generatie mislukt' }, { status: 500 });
      }

      const imageData = await imageResponse.json();
      const message = imageData.choices?.[0]?.message;

      // Check for images in the response
      if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
        const image = message.images[0] as ImageResponse;
        if (image.image_url?.url) {
          // Generate a new caption for the new image
          const newCaptionPrompt = `Schrijf een korte, informatieve caption voor een educatieve afbeelding.

Context:
- Onderwerp: "${onderwerp}"
- Beschrijving afbeelding: "${improvedPrompt}"
${niveau ? `- Niveau: ${niveau}` : ''}

Schrijf een caption van 1-2 zinnen die begint met "Afb:" en informatief is voor leerlingen.
Geef ALLEEN de caption terug.`;

          const captionController = createTimeoutController(OPENROUTER_CAPTION_TIMEOUT_MS);

          const captionResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: CAPTION_MODEL,
              messages: [{ role: 'user', content: newCaptionPrompt }],
              max_tokens: 100,
            }),
            signal: captionController.signal,
          });

          let newCaption = `Afb: ${onderwerp}`;
          if (captionResponse.ok) {
            const captionData = await captionResponse.json();
            newCaption = captionData.choices?.[0]?.message?.content?.trim() || newCaption;
          }

          return NextResponse.json({
            action: 'image-regenerated',
            newImageUrl: image.image_url.url,
            newCaption,
            newAlt: improvedPrompt,
            usedProModel: action === 'regenerate-pro',
          });
        }
      }

      return NextResponse.json({ error: 'Geen afbeelding gegenereerd' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logTimeoutAbort('fix-image', OPENROUTER_IMAGE_TIMEOUT_MS);
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }

    console.error('Fix image error:', error);
    return NextResponse.json(
      { error: 'Er ging iets mis' },
      { status: 500 }
    );
  }
}
