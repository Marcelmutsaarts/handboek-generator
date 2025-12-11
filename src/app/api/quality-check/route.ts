import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const maxDuration = 60;

interface QualityCheckRequest {
  content: string;
  niveau: string;
  leerjaar: number;
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

export async function POST(request: NextRequest) {
  try {
    const body: QualityCheckRequest = await request.json();
    const { content, niveau, leerjaar } = body;

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

    const prompt = `Je bent een ervaren onderwijskundige expert die educatieve content beoordeelt.

Analyseer de volgende tekst kritisch op kwaliteit voor ${niveauLabel}, leerjaar ${leerjaar}.

TEKST OM TE BEOORDELEN:
"""
${content}
"""

Beoordeel de tekst op deze 4 criteria en geef per criterium:
- Een score van 1-5 (1=slecht, 5=uitstekend)
- Concrete feedback met voorbeelden uit de tekst

1. BIAS & INCLUSIVITEIT (score 1-5)
   - Zijn er gender stereotypen? (bijv. "wetenschappers zijn mannen", "verplegers zijn vrouwen")
   - Zijn er culturele aannames of vooroordelen?
   - Zijn voorbeelden divers en inclusief?
   - Worden personen genderneutraal beschreven waar mogelijk?

2. HELDERHEID & BEGRIJPELIJKHEID (score 1-5)
   - Is de taal helder en begrijpelijk?
   - Zijn zinnen niet te lang of complex?
   - Worden moeilijke woorden uitgelegd?
   - Is de tekst logisch opgebouwd?

3. DIDACTISCHE KWALITEIT (score 1-5)
   - Is de structuur helder en logisch?
   - Zijn voorbeelden concreet en passend?
   - Bouwt de tekst goed op van eenvoudig naar complex?
   - Zijn er voldoende voorbeelden en uitleg?

4. NIVEAU-GESCHIKTHEID (score 1-5)
   - Past de taal bij ${niveauLabel} leerjaar ${leerjaar}?
   - Is de diepgang passend bij dit niveau?
   - Zijn voorbeelden leeftijdsgeschikt?
   - Is de moeilijkheidsgraad correct?

Antwoord in dit EXACTE JSON formaat (geen extra tekst, alleen JSON):
{
  "bias": {
    "score": 4,
    "feedback": ["Concrete feedback punt 1", "Feedback punt 2"]
  },
  "helderheid": {
    "score": 5,
    "feedback": ["Concrete feedback punt 1"]
  },
  "didactiek": {
    "score": 4,
    "feedback": ["Concrete feedback punt 1", "Feedback punt 2"]
  },
  "niveauGeschikt": {
    "score": 5,
    "feedback": ["Concrete feedback punt 1"]
  },
  "samenvatting": "Korte algemene beoordeling in 1-2 zinnen"
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        temperature: 0.3, // Lager voor consistentere beoordelingen
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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

    // Calculate total score and recommendation
    const totaal =
      (parsed.bias.score +
        parsed.helderheid.score +
        parsed.didactiek.score +
        parsed.niveauGeschikt.score) /
      4;

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
    console.error('Quality check error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Kwaliteitscheck timeout - probeer opnieuw' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to check quality', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
