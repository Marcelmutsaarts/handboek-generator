import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const maxDuration = 120;

interface ImproveRequest {
  content: string;
  qualityReport: {
    bias: { score: number; feedback: string[] };
    helderheid: { score: number; feedback: string[] };
    didactiek: { score: number; feedback: string[] };
    niveauGeschikt: { score: number; feedback: string[] };
    samenvatting: string;
  };
  niveau: string;
  leerjaar: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ImproveRequest = await request.json();
    const { content, qualityReport, niveau, leerjaar } = body;

    if (!content || !qualityReport) {
      return NextResponse.json(
        { error: 'Missing required fields: content, qualityReport' },
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

    // Build feedback text from quality report
    const feedbackText = `
KWALITEITSSCORE: ${qualityReport.bias.score + qualityReport.helderheid.score + qualityReport.didactiek.score + qualityReport.niveauGeschikt.score} / 20

BIAS & INCLUSIVITEIT (score: ${qualityReport.bias.score}/5):
${qualityReport.bias.feedback.map((f) => `- ${f}`).join('\n')}

HELDERHEID (score: ${qualityReport.helderheid.score}/5):
${qualityReport.helderheid.feedback.map((f) => `- ${f}`).join('\n')}

DIDACTIEK (score: ${qualityReport.didactiek.score}/5):
${qualityReport.didactiek.feedback.map((f) => `- ${f}`).join('\n')}

NIVEAU-GESCHIKTHEID (score: ${qualityReport.niveauGeschikt.score}/5):
${qualityReport.niveauGeschikt.feedback.map((f) => `- ${f}`).join('\n')}

ALGEMEEN: ${qualityReport.samenvatting}
`.trim();

    const prompt = `Je bent een ervaren onderwijsauteur. Verbeter de onderstaande tekst op basis van de kwaliteitsfeedback.

HUIDIGE TEKST:
"""
${content}
"""

KWALITEITSFEEDBACK:
${feedbackText}

INSTRUCTIES:
1. Verwerk alle feedback punten waar de score lager dan 5 is
2. Behoud de EXACTE structuur (alle kopjes, secties)
3. Behoud ALLE afbeeldingmarkers EXACT zoals ze zijn: [AFBEELDING: ...]
4. Verbeter alleen de tekstuele inhoud
5. Zorg dat de tekst past bij niveau ${niveau}, leerjaar ${leerjaar}
6. Maak de tekst inclusiever, helderder en didactisch sterker

BELANGRIJK:
- Verander NIETS aan de structuur of afbeeldingmarkers
- Lever de COMPLETE verbeterde tekst
- Gebruik exact dezelfde koppen en secties`;

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
        model: 'google/gemini-2.0-flash-exp:free',
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
