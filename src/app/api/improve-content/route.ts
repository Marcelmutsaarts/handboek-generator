import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
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

BELANGRIJK:
- Verander NIETS aan de structuur of afbeeldingmarkers
- Lever de COMPLETE verbeterde tekst (niet alleen de aangepaste delen)
- Gebruik exact dezelfde koppen en secties
- Pas ALLEEN de specifieke feedback punten toe die zijn geselecteerd`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

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

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter error:', error);
      return NextResponse.json(
        { error: `OpenRouter API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const improvedContent = data.choices[0]?.message?.content;

    if (!improvedContent) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    return NextResponse.json({ improved: improvedContent.trim() });
  } catch (error) {
    console.error('Improve content error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Verbetering timeout - probeer opnieuw' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to improve content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
