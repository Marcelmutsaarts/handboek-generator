import { NextRequest, NextResponse } from 'next/server';
import { OPENROUTER_QUALITY_TIMEOUT_MS, createTimeoutController, logTimeoutAbort } from '@/lib/apiLimits';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface SelectedFeedback {
  criterium: string;
  feedbackItem: string;
}

interface ImproveRequest {
  content: string;
  selectedFeedback: SelectedFeedback[];
  niveau: string;
  leerjaar: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ImproveRequest = await request.json();
    const { content, selectedFeedback, niveau, leerjaar } = body;

    if (!content || !selectedFeedback || selectedFeedback.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: content, selectedFeedback' },
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

    // Build feedback text from selected feedback items
    const feedbackText = selectedFeedback
      .map((item) => `[${item.criterium}] ${item.feedbackItem}`)
      .join('\n');

    const prompt = `Je bent een ervaren onderwijsauteur. Verbeter de onderstaande tekst op basis van de GESELECTEERDE kwaliteitsfeedback.

HUIDIGE TEKST:
"""
${content}
"""

GESELECTEERDE FEEDBACK PUNTEN OM TE VERWERKEN:
${feedbackText}

INSTRUCTIES:
1. Verwerk ALLEEN de bovenstaande geselecteerde feedback punten
2. Behoud de EXACTE structuur (alle kopjes, secties)
3. Behoud ALLE afbeeldingmarkers EXACT zoals ze zijn: [AFBEELDING: ...]
4. Behoud ALLE bronvermeldingen en citaties EXACT zoals ze zijn
5. Verbeter alleen de tekstuele inhoud waar de feedback op slaat
6. Zorg dat de tekst past bij niveau ${niveau}, leerjaar ${leerjaar}
7. Negeer andere aspecten die niet in de geselecteerde feedback staan

KRITISCH - OUTPUT FORMAT:
- Begin DIRECT met de eerste kop (# Titel) van het hoofdstuk
- GEEN inleidende tekst zoals "Hier is de verbeterde tekst" of "De aangepaste versie"
- GEEN uitleg over wat je hebt veranderd
- ALLEEN de verbeterde tekst zelf, niets anders
- Lever de COMPLETE verbeterde tekst (niet alleen de aangepaste delen)`;

    const controller = createTimeoutController(OPENROUTER_QUALITY_TIMEOUT_MS);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': request.headers.get('origin') || 'https://handboek-generator.vercel.app',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter error:', error);
      return NextResponse.json(
        { error: `OpenRouter API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    let improvedContent = data.choices[0]?.message?.content;

    if (!improvedContent) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Clean up any introductory text the AI might have added
    // Look for the first markdown heading and start from there
    const headingMatch = improvedContent.match(/^([\s\S]*?)(#\s+.+)/m);
    if (headingMatch && headingMatch[1].trim().length > 0 && headingMatch[1].trim().length < 200) {
      // There's text before the first heading - likely an intro, remove it
      improvedContent = improvedContent.substring(headingMatch.index! + headingMatch[1].length);
    }

    return NextResponse.json({ improved: improvedContent.trim() });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logTimeoutAbort('improve-content', OPENROUTER_QUALITY_TIMEOUT_MS);
      return NextResponse.json(
        { error: 'Verbetering timeout - probeer opnieuw' },
        { status: 408 }
      );
    }

    console.error('Improve content error:', error);
    return NextResponse.json(
      { error: 'Failed to improve content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
