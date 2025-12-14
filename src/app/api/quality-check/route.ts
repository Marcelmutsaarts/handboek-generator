import { NextRequest, NextResponse } from 'next/server';
import { OPENROUTER_QUALITY_TIMEOUT_MS, createTimeoutController, logTimeoutAbort } from '@/lib/apiLimits';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface ImageData {
  url: string;
  caption: string | null;
  alt: string | null;
}

interface QualityCheckRequest {
  content: string;
  niveau: string;
  leerjaar: number;
  context?: string;
  images?: ImageData[]; // NEW: afbeeldingen met captions voor multimodal analyse
}

interface QualityScore {
  score: number;
  feedback: string[];
}

interface QualityReport {
  bias: QualityScore;
  helderheid: QualityScore;
  didactiek: QualityScore;
  niveauGeschikt: QualityScore;
  afbeeldingen?: QualityScore; // NEW: optional voor backwards compatibility
  totaal: number;
  aanbeveling: 'excellent' | 'goed' | 'verbeteren';
  samenvatting: string;
}

const NIVEAU_LABELS: Record<string, string> = {
  po_onder: 'Basisschool onderbouw (groep 1-4)',
  po_boven: 'Basisschool bovenbouw (groep 5-8)',
  vmbo: 'VMBO',
  havo: 'HAVO',
  vwo: 'VWO',
  mbo: 'MBO',
  hbo: 'HBO',
  uni: 'Universiteit',
};

// Multimodal model that can see images
const MULTIMODAL_MODEL = 'google/gemini-2.0-flash-001';
const TEXT_ONLY_MODEL = 'google/gemini-3-pro-preview';

export async function POST(request: NextRequest) {
  try {
    const body: QualityCheckRequest = await request.json();
    const { content, niveau, leerjaar, context, images } = body;

    if (!content || !niveau || !leerjaar) {
      return NextResponse.json(
        { error: 'Missing required fields: content, niveau, leerjaar' },
        { status: 400 }
      );
    }

    // Get API key from header
    const apiKey = request.headers.get('X-OpenRouter-Key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required. Set your OpenRouter key in settings.' },
        { status: 401 }
      );
    }

    const niveauLabel = NIVEAU_LABELS[niveau] || niveau;
    const hasImages = images && images.length > 0;
    // Check if we have actual image URLs (not empty/base64) for multimodal analysis
    const hasImageUrls = hasImages && images.some(img => img.url && !img.url.startsWith('data:') && img.url.length > 0);

    const contextNote = context
      ? `\n\nLET OP: Dit hoofdstuk is gepersonaliseerd met context "${context}". Voorbeelden en vergelijkingen gerelateerd aan "${context}" zijn GEWENST en geen probleem voor bias of didactiek.`
      : '';

    // Build image captions section for the prompt
    const imageCaptionsSection = hasImages
      ? `\n\nAFBEELDINGEN IN DIT HOOFDSTUK:
${images.map((img, i) => `Afbeelding ${i + 1}: Caption: "${img.caption || 'Geen caption'}" | Alt: "${img.alt || 'Geen alt'}"`).join('\n')}`
      : '';

    // Build the prompt - add images criterion only if images are present
    const imagesCriterion = hasImages
      ? `\n5. AFBEELDINGEN & ONDERSCHRIFTEN - Bekijk elke afbeelding en beoordeel:
   - Past de afbeelding bij het onderwerp "${content.split('\n')[0]?.replace(/^#\s*/, '') || 'het hoofdstuk'}"?
   - Is de caption/onderschrift correct en informatief?
   - Zijn er spelfouten of grammaticale fouten in de caption?
   - Is de caption logisch gezien wat er op de afbeelding staat?
   - Is de afbeelding geschikt voor het onderwijsniveau?`
      : '';

    const imagesJsonExample = hasImages
      ? `,
  "afbeeldingen": {"score": 4, "feedback": ["Afbeelding 2 caption bevat spelfout: 'fotosythese' moet 'fotosynthese' zijn", "Afbeelding 1 toont een boom maar caption spreekt over bloemen"]}`
      : '';

    const promptText = `Beoordeel deze educatieve tekst voor ${niveauLabel}, leerjaar ${leerjaar}.${contextNote}${imageCaptionsSection}

TEKST:
${content}

Geef scores 1-5 en max 2 concrete feedback punten per criterium:

1. BIAS & INCLUSIVITEIT - Gender stereotypen, culturele aannames, diversiteit (niet: gepersonaliseerde voorbeelden)
2. HELDERHEID - Taal, zinscomplexiteit, uitleg moeilijke woorden
3. DIDACTIEK - Structuur, voorbeelden, opbouw
4. NIVEAU - Taalgebruik en diepgang passend bij niveau${imagesCriterion}

JSON (geen extra tekst):
{
  "bias": {"score": 4, "feedback": ["punt 1", "punt 2"]},
  "helderheid": {"score": 5, "feedback": ["punt 1"]},
  "didactiek": {"score": 4, "feedback": ["punt 1", "punt 2"]},
  "niveauGeschikt": {"score": 5, "feedback": ["punt 1"]}${imagesJsonExample},
  "samenvatting": "1-2 zinnen algemene beoordeling"
}`;

    // Build message content - multimodal only if we have actual image URLs
    let messageContent: string | { type: string; text?: string; image_url?: { url: string } }[];
    let model: string;

    if (hasImageUrls) {
      // Multimodal message with images
      const contentParts: { type: string; text?: string; image_url?: { url: string } }[] = [
        { type: 'text', text: promptText }
      ];

      // Add each image to the message (only valid HTTPS URLs)
      for (const img of images!) {
        if (img.url && !img.url.startsWith('data:') && img.url.length > 0) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: img.url }
          });
        }
      }

      messageContent = contentParts;
      model = MULTIMODAL_MODEL;
      console.log('Using multimodal analysis with', contentParts.length - 1, 'images');
    } else {
      // Text-only message (also used when images have no URLs - just analyze captions)
      messageContent = promptText;
      model = TEXT_ONLY_MODEL;
      console.log('Using text-only analysis', hasImages ? '(images have no valid URLs, analyzing captions only)' : '');
    }

    const controller = createTimeoutController(OPENROUTER_QUALITY_TIMEOUT_MS);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': request.headers.get('origin') || 'https://handboek-generator.vercel.app',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: messageContent }],
        temperature: 0.3, // Lager voor consistentere beoordelingen
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter error:', error);

      // Better error messages for common issues
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit bereikt. Wacht even en probeer het opnieuw.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `OpenRouter API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Parse JSON response
    let parsed;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      return NextResponse.json(
        { error: 'Failed to parse quality report', details: aiResponse },
        { status: 500 }
      );
    }

    // Calculate total score - include images if present
    const scores = [
      parsed.bias?.score || 0,
      parsed.helderheid?.score || 0,
      parsed.didactiek?.score || 0,
      parsed.niveauGeschikt?.score || 0,
    ];

    if (hasImages && parsed.afbeeldingen?.score) {
      scores.push(parsed.afbeeldingen.score);
    }

    const totaal = scores.reduce((a, b) => a + b, 0) / scores.length;

    let aanbeveling: 'excellent' | 'goed' | 'verbeteren';
    if (totaal >= 4.5) {
      aanbeveling = 'excellent';
    } else if (totaal >= 3.5) {
      aanbeveling = 'goed';
    } else {
      aanbeveling = 'verbeteren';
    }

    const report: QualityReport = {
      ...parsed,
      totaal: Math.round(totaal * 10) / 10,
      aanbeveling,
    };

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logTimeoutAbort('quality-check', OPENROUTER_QUALITY_TIMEOUT_MS);
      return NextResponse.json(
        { error: 'Kwaliteitscheck timeout - probeer opnieuw' },
        { status: 408 }
      );
    }

    console.error('Quality check error:', error);

    return NextResponse.json(
      { error: 'Failed to check quality', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
