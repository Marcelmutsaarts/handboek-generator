'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import ChapterDisplay from '@/components/ChapterDisplay';
import QualityFeedbackModal from '@/components/QualityFeedbackModal';
import { QualityReport } from '@/components/QualityCheckModal';
import SourceVerificationModal, { SourceVerificationReport } from '@/components/SourceVerificationModal';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Handboek, Hoofdstuk, Lengte, AfbeeldingType, ChapterImage, getTemplate, WOORDEN_PER_LENGTE, HoofdstukPlan } from '@/types';
import { getApiKeyHeader } from '@/hooks/useApiKey';

const LENGTES: { value: Lengte; label: string; description: string; woorden: number }[] = [
  { value: 'kort', label: 'Kort', description: '~800 woorden', woorden: 800 },
  { value: 'medium', label: 'Medium', description: '~1500 woorden', woorden: 1500 },
  { value: 'lang', label: 'Lang', description: '~2500 woorden', woorden: 2500 },
];

const AFBEELDING_TYPES: { value: AfbeeldingType; label: string; description: string }[] = [
  { value: 'geen', label: 'Geen', description: 'Alleen tekst' },
  { value: 'stock', label: "Stockfoto's", description: 'Via Pexels' },
  { value: 'ai', label: 'AI-gegenereerd', description: 'Via Gemini' },
];

type PageState = 'loading' | 'form' | 'generating' | 'result';

export default function NieuwHoofdstukPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const handboekId = params.id as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [handboek, setHandboek] = useState<Handboek | null>(null);
  const [eerdereHoofdstukken, setEerdereHoofdstukken] = useState<Hoofdstuk[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedPlan, setSelectedPlan] = useState<HoofdstukPlan | null>(null);
  const [onderwerp, setOnderwerp] = useState('');
  const [leerdoelen, setLeerdoelen] = useState('');
  const [lengte, setLengte] = useState<Lengte>('medium');
  const [woordenAantal, setWoordenAantal] = useState(WOORDEN_PER_LENGTE.medium);
  const [afbeeldingType, setAfbeeldingType] = useState<AfbeeldingType>('stock');
  const [laatstePlaatjeInfographic, setLaatstePlaatjeInfographic] = useState(false);
  const [metBronnen, setMetBronnen] = useState(false);

  // Bepaal of slider afwijkt van preset
  const isCustomWoorden = woordenAantal !== WOORDEN_PER_LENGTE[lengte];

  // Generation state
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<ChapterImage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedHoofdstukId, setSavedHoofdstukId] = useState<string | null>(null);
  const lastFlushRef = useRef(0);

  // Quality check state
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [isCheckingQuality, setIsCheckingQuality] = useState(false);
  const [isImproving, setIsImproving] = useState(false);

  // Source verification state
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceReport, setSourceReport] = useState<SourceVerificationReport | null>(null);
  const [isVerifyingSources, setIsVerifyingSources] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchHandboekEnHoofdstukken = async () => {
      if (!user || !handboekId) return;

      const supabase = createClient();

      // Fetch handboek
      const { data: handboekData, error: handboekError } = await supabase
        .from('handboeken')
        .select('*')
        .eq('id', handboekId)
        .single();

      if (handboekError || !handboekData) {
        setError('Handboek niet gevonden');
        setPageState('form');
        return;
      }

      setHandboek(handboekData);

      // Fetch eerdere hoofdstukken voor context
      const { data: hoofdstukkenData } = await supabase
        .from('hoofdstukken')
        .select('*')
        .eq('handboek_id', handboekId)
        .order('volgorde', { ascending: true });

      if (hoofdstukkenData) {
        setEerdereHoofdstukken(hoofdstukkenData);
      }

      setPageState('form');
    };

    if (user) {
      fetchHandboekEnHoofdstukken();
    }
  }, [user, handboekId]);

  // Haal geplande hoofdstukken op die nog niet gegenereerd zijn
  const getOngegeneerdeHoofdstukken = (): HoofdstukPlan[] => {
    if (!handboek?.structuur?.hoofdstukken) return [];

    return handboek.structuur.hoofdstukken.filter(plan => {
      // Check of er al een hoofdstuk bestaat met vergelijkbare titel
      const isAlGegenereerd = eerdereHoofdstukken.some(h =>
        h.titel.toLowerCase().trim() === plan.titel.toLowerCase().trim() ||
        h.onderwerp.toLowerCase().includes(plan.titel.toLowerCase().trim())
      );
      return !isAlGegenereerd && plan.status !== 'generated';
    });
  };

  const handleSelectPlan = (plan: HoofdstukPlan) => {
    setSelectedPlan(plan);
    setOnderwerp(plan.titel);
    if (plan.beschrijving) {
      setLeerdoelen(plan.beschrijving);
    }
  };

  const extractImageTerms = (generatedContent: string): string[] => {
    const imageMatches = generatedContent.match(/\[AFBEELDING:\s*([^\]]+)\]/g);
    if (!imageMatches) return [];

    return imageMatches.map((match) => {
      const terms = match.match(/\[AFBEELDING:\s*([^\]]+)\]/);
      return terms ? terms[1] : '';
    }).filter(Boolean);
  };

  const fetchStockImages = async (generatedContent: string, onderwerp: string) => {
    const searchTerms = extractImageTerms(generatedContent);
    if (searchTerms.length === 0) return;

    setIsLoadingImages(true);
    try {
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeader(),
        },
        body: JSON.stringify({ searchTerms }),
      });

      if (response.ok) {
        const data = await response.json();
        const stockImages: ChapterImage[] = data.images || [];

        // Generate captions for stock images (same as AI images)
        const imagesWithCaptions = await Promise.all(
          stockImages.map(async (img: ChapterImage, index: number) => {
            const imageDescription = searchTerms[index] || img.alt || '';
            const caption = await generateCaption(img.url, imageDescription, onderwerp);
            return { ...img, caption };
          })
        );

        setImages(imagesWithCaptions);
      }
    } catch (err) {
      console.error('Error fetching stock images:', err);
    } finally {
      setIsLoadingImages(false);
    }
  };

  const generateCaption = async (imageUrl: string, imageDescription: string, onderwerp: string): Promise<string | undefined> => {
    try {
      const response = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeader(),
        },
        body: JSON.stringify({
          imageUrl,
          onderwerp,
          imageDescription,
          niveau: handboek?.niveau,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.caption;
      }
    } catch (err) {
      console.error('Error generating caption:', err);
    }
    return undefined;
  };

  const fetchAiImages = async (generatedContent: string, onderwerp: string, withInfographic: boolean) => {
    const searchTerms = extractImageTerms(generatedContent);
    if (searchTerms.length === 0 && !withInfographic) return;

    setIsLoadingImages(true);
    const generatedImages: ChapterImage[] = [];

    // Generate regular images concurrently
    await Promise.allSettled(
      searchTerms.map(async (term) => {
        try {
          const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getApiKeyHeader(),
            },
            body: JSON.stringify({ prompt: term, onderwerp }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.imageUrl) {
              // Generate caption for this image
              const caption = await generateCaption(data.imageUrl, term, onderwerp);
              generatedImages.push({
                url: data.imageUrl,
                alt: data.alt || term,
                caption,
                isAiGenerated: true,
              });
            }
          }
        } catch (err) {
          console.error('Error generating AI image:', err);
        }
      })
    );
    if (generatedImages.length > 0) {
      setImages([...generatedImages]);
    }

    // Generate infographic as last image if requested
    if (withInfographic) {
      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getApiKeyHeader(),
          },
          body: JSON.stringify({
            prompt: 'Infographic samenvatting',
            onderwerp,
            isInfographic: true,
            chapterContent: generatedContent,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.imageUrl) {
            // Generate caption for infographic
            const caption = await generateCaption(data.imageUrl, `Infographic samenvatting van ${onderwerp}`, onderwerp);
            generatedImages.push({
              url: data.imageUrl,
              alt: `Infographic: ${onderwerp}`,
              caption,
              isAiGenerated: true,
            });
            setImages([...generatedImages]);
          }
        }
      } catch (err) {
        console.error('Error generating infographic:', err);
      }
    }

    setIsLoadingImages(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onderwerp.trim() || !handboek) return;

    setPageState('generating');
    setContent('');
    setPrompt('');
    setImages([]);
    setError(null);
    setIsStreaming(true);

    try {
      const formData = {
        onderwerp: onderwerp.trim(),
        niveau: handboek.niveau,
        leerjaar: handboek.leerjaar,
        leerdoelen: leerdoelen.trim(),
        lengte,
        woordenAantal,
        metAfbeeldingen: afbeeldingType !== 'geen',
        afbeeldingType,
        laatstePlaatjeInfographic,
        metBronnen,
        context: handboek.context || '',
        template: handboek.template || 'klassiek',
        customSecties: handboek.custom_secties || [],
      };

      // Bereid eerdere hoofdstukken context voor
      const eerdereHoofdstukkenContext = eerdereHoofdstukken.map((h) => {
        // Extract samenvatting uit content (zoek naar ## Samenvatting sectie)
        const samenvattingMatch = h.content.match(/## Samenvatting\n([\\s\\S]*?)(?=\n##|$)/);
        const samenvatting = samenvattingMatch
          ? samenvattingMatch[1].trim().slice(0, 500) // Limit samenvatting lengte
          : undefined;

        return {
          titel: h.titel,
          onderwerp: h.onderwerp,
          samenvatting,
        };
      });

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeader(),
        },
        body: JSON.stringify({
          ...formData,
          eerdereHoofdstukken: eerdereHoofdstukkenContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Generatie mislukt');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Geen response stream');

      const decoder = new TextDecoder();
      lastFlushRef.current = performance.now();
      let fullContent = '';
      const flushContent = () => {
        setContent(fullContent);
        lastFlushRef.current = performance.now();
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'prompt') {
                setPrompt(data.content);
              } else if (data.type === 'content') {
                fullContent += data.content;
                const now = performance.now();
                if (now - lastFlushRef.current > 120) {
                  flushContent();
                }
              } else if (data.type === 'done') {
                flushContent();
                setIsStreaming(false);
                setPageState('result');

                if (afbeeldingType === 'stock') {
                  fetchStockImages(fullContent, onderwerp);
                } else if (afbeeldingType === 'ai') {
                  fetchAiImages(fullContent, onderwerp, laatstePlaatjeInfographic);
                }
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
      setIsStreaming(false);
      setPageState('form');
    }
  };

  const handleSave = async () => {
    if (!handboek || !content) return;

    setIsSaving(true);
    setError(null);

    const supabase = createClient();

    // Get current highest volgorde
    const { data: existingHoofdstukken } = await supabase
      .from('hoofdstukken')
      .select('volgorde')
      .eq('handboek_id', handboekId)
      .order('volgorde', { ascending: false })
      .limit(1);

    const nextVolgorde = existingHoofdstukken && existingHoofdstukken.length > 0
      ? existingHoofdstukken[0].volgorde + 1
      : 0;

    // Extract title from content (first # heading)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const titel = titleMatch ? titleMatch[1] : onderwerp;

    // Save hoofdstuk
    const { data: hoofdstukData, error: hoofdstukError } = await supabase
      .from('hoofdstukken')
      .insert({
        handboek_id: handboekId,
        titel,
        onderwerp,
        content,
        prompt_used: prompt,
        volgorde: nextVolgorde,
        lengte,
        leerdoelen: leerdoelen.trim() || null,
      })
      .select()
      .single();

    if (hoofdstukError) {
      console.error('Error saving hoofdstuk:', hoofdstukError);
      setError('Kon hoofdstuk niet opslaan');
      setIsSaving(false);
      return;
    }

    // Save afbeeldingen
    if (images.length > 0) {
      const afbeeldingenData = images.map((img, index) => ({
        hoofdstuk_id: hoofdstukData.id,
        url: img.url,
        alt: img.alt || null,
        caption: img.caption || null,
        photographer: img.photographer || null,
        photographer_url: img.photographerUrl || null,
        is_ai_generated: img.isAiGenerated || false,
        volgorde: index,
      }));

      const { error: afbeeldingenError } = await supabase
        .from('afbeeldingen')
        .insert(afbeeldingenData);

      if (afbeeldingenError) {
        console.error('Error saving afbeeldingen:', afbeeldingenError);
        // Don't fail completely, hoofdstuk is saved
      }
    }

    // Update de structuur als dit een gepland hoofdstuk was
    if (selectedPlan && handboek?.structuur?.hoofdstukken) {
      const updatedHoofdstukken = handboek.structuur.hoofdstukken.map(h =>
        h.id === selectedPlan.id
          ? { ...h, status: 'generated' as const, hoofdstukId: hoofdstukData.id }
          : h
      );

      await supabase
        .from('handboeken')
        .update({ structuur: { hoofdstukken: updatedHoofdstukken } })
        .eq('id', handboekId);
    }

    setSavedHoofdstukId(hoofdstukData.id);
    setIsSaving(false);
  };

  const handleQualityCheck = async () => {
    if (!content || !handboek) return;

    setShowQualityModal(true);
    setIsCheckingQuality(true);
    setQualityReport(null);

    try {
      const response = await fetch('/api/quality-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeader(),
        },
        body: JSON.stringify({
          content,
          niveau: handboek.niveau,
          leerjaar: handboek.leerjaar,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Kwaliteitscheck mislukt');
      }

      const report: QualityReport = await response.json();
      setQualityReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kwaliteitscheck mislukt');
      setShowQualityModal(false);
    } finally {
      setIsCheckingQuality(false);
    }
  };

  const handleImprove = async (selectedFeedback: { criterium: string; feedbackItem: string }[]) => {
    if (!content || !handboek || selectedFeedback.length === 0) return;

    setIsImproving(true);

    try {
      const response = await fetch('/api/improve-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeader(),
        },
        body: JSON.stringify({
          content,
          selectedFeedback,
          niveau: handboek.niveau,
          leerjaar: handboek.leerjaar,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Verbeteren mislukt');
      }

      const data = await response.json();
      setContent(data.improved);
      setShowQualityModal(false);
      setQualityReport(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbeteren mislukt');
    } finally {
      setIsImproving(false);
    }
  };

  const extractSources = (generatedContent: string): { title: string; url: string }[] => {
    const sources: { title: string; url: string }[] = [];

    // Find ## Bronnen section (case-insensitive, flexible whitespace)
    const bronnenMatch = generatedContent.match(/##\s*Bronnen\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (!bronnenMatch) {
      console.warn('Geen ## Bronnen sectie gevonden in content');
      console.log('Content preview:', generatedContent.substring(0, 500));
      return sources;
    }

    const bronnenSection = bronnenMatch[1];
    console.log('Bronnen sectie gevonden:', bronnenSection.substring(0, 200));

    // Extract markdown links: - [Title](URL) or [Title](URL) without dash
    // More flexible: allows optional dash and spaces
    const linkRegex = /-?\s*\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(bronnenSection)) !== null) {
      sources.push({
        title: match[1].trim(),
        url: match[2].trim(),
      });
    }

    console.log(`${sources.length} bronnen geëxtraheerd`);
    return sources;
  };

  const handleVerifySources = async () => {
    if (!content || !metBronnen) return;

    const sources = extractSources(content);

    if (sources.length === 0) {
      setError('Geen bronnen gevonden in het hoofdstuk');
      return;
    }

    setShowSourceModal(true);
    setIsVerifyingSources(true);
    setSourceReport(null);

    try {
      const response = await fetch('/api/verify-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sources }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Bronverificatie mislukt');
      }

      const report: SourceVerificationReport = await response.json();
      setSourceReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bronverificatie mislukt');
      setShowSourceModal(false);
    } finally {
      setIsVerifyingSources(false);
    }
  };

  const handleRetryGeneration = () => {
    setShowSourceModal(false);
    setSourceReport(null);
    // Reset to form state to allow regeneration
    setPageState('form');
  };

  const handleRemoveBadSources = () => {
    if (!sourceReport || !content) return;

    // Get bad sources (unreachable, invalid, suspicious)
    const badSources = sourceReport.results.filter(
      (r) => r.status === 'unreachable' || r.status === 'invalid' || r.status === 'suspicious'
    );

    if (badSources.length === 0) {
      setShowSourceModal(false);
      return;
    }

    // Find the Bronnen section (case-insensitive, flexible whitespace)
    const bronnenMatch = content.match(/##\s*Bronnen\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (!bronnenMatch) {
      console.warn('Geen bronnenlijst gevonden in content');
      setError('Geen bronnenlijst gevonden om te bewerken');
      return;
    }

    const bronnenSection = bronnenMatch[1];
    let updatedBronnenSection = bronnenSection;

    // Remove each bad source from the bronnen section only
    badSources.forEach((badSource) => {
      // Escape special regex characters in URL
      const escapedUrl = badSource.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Match the entire line with this URL
      // Format: - [Title](URL) or - [Title](URL) - Description
      const pattern = new RegExp(`^- \\[[^\\]]*\\]\\(${escapedUrl}\\)[^\\n]*\\n?`, 'gm');

      const beforeLength = updatedBronnenSection.length;
      updatedBronnenSection = updatedBronnenSection.replace(pattern, '');
      const afterLength = updatedBronnenSection.length;

      if (beforeLength === afterLength) {
        console.warn('Bron niet gevonden in lijst:', badSource.url);
      } else {
        console.log('Bron verwijderd:', badSource.url);
      }
    });

    // Replace the bronnen section in the full content
    const updatedContent = content.replace(
      /##\s*Bronnen\s*\n[\s\S]*?(?=\n##|$)/i,
      `## Bronnen\n${updatedBronnenSection}`
    );

    // Only update if something actually changed
    if (updatedContent !== content) {
      setContent(updatedContent);
      console.log('Content bijgewerkt, bronnen verwijderd');
    } else {
      console.warn('Geen wijzigingen aangebracht');
    }

    setShowSourceModal(false);
    setSourceReport(null);
  };

  if (authLoading || pageState === 'loading') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!handboek) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700 mb-4">{error || 'Handboek niet gevonden'}</p>
            <Link href="/handboeken" className="text-primary hover:underline">
              Terug naar handboeken
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href={`/handboeken/${handboekId}`}
          className="flex items-center gap-2 text-secondary hover:text-foreground transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Terug naar {handboek.titel}
        </Link>

        {pageState === 'form' && (
          <div className="bg-white rounded-xl p-6 border border-border">
            <h1 className="text-xl font-bold text-foreground mb-2">
              Nieuw hoofdstuk genereren
              {eerdereHoofdstukken.length > 0 && (
                <span className="text-sm font-normal text-secondary ml-2">
                  (wordt hoofdstuk {eerdereHoofdstukken.length + 1})
                </span>
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
              <span className="px-2.5 py-1 bg-accent rounded-lg">
                {handboek.niveau.toUpperCase()} - Jaar {handboek.leerjaar}
              </span>
              {handboek.template && (
                <span className="px-2.5 py-1 bg-accent rounded-lg flex items-center gap-1.5">
                  <span>{getTemplate(handboek.template)?.icon || 'ĐY""'}</span>
                  <span>{getTemplate(handboek.template)?.naam || handboek.template}</span>
                </span>
              )}
              {handboek.context && (
                <span className="px-2.5 py-1 bg-accent rounded-lg">
                  {handboek.context}
                </span>
              )}
            </div>

            {/* Geplande hoofdstukken */}
            {(() => {
              const ongegenereerd = getOngegeneerdeHoofdstukken();
              if (ongegenereerd.length === 0) return null;

              return (
                <div className="bg-gradient-to-r from-primary/10 to-blue-100 border border-primary/30 rounded-lg p-4 mb-6">
                  <p className="text-foreground text-sm font-medium mb-3">
                    Kies een gepland hoofdstuk om te genereren:
                  </p>
                  <div className="space-y-2">
                    {ongegenereerd.map((plan, index) => {
                      // Bereken het volgordenummer in de originele structuur
                      const origIndex = handboek?.structuur?.hoofdstukken.findIndex(h => h.id === plan.id) ?? index;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => handleSelectPlan(plan)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedPlan?.id === plan.id
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white border-border hover:border-primary'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                              selectedPlan?.id === plan.id
                                ? 'bg-white/20 text-white'
                                : 'bg-accent text-secondary'
                            }`}>
                              {origIndex + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium block">{plan.titel}</span>
                              {plan.beschrijving && (
                                <span className={`text-xs block mt-0.5 ${
                                  selectedPlan?.id === plan.id ? 'text-white/80' : 'text-secondary'
                                }`}>
                                  {plan.beschrijving}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-secondary mt-3">
                    Of vul hieronder zelf een onderwerp in.
                  </p>
                </div>
              );
            })()}

            {eerdereHoofdstukken.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-blue-800 text-sm font-medium mb-2">
                  Context van eerdere hoofdstukken wordt meegenomen:
                </p>
                <ul className="text-blue-700 text-sm space-y-1">
                  {eerdereHoofdstukken.map((h, i) => (
                    <li key={h.id} className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </span>
                      {h.titel}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-6">
              {/* Onderwerp */}
              <div>
                <label htmlFor="onderwerp" className="block text-sm font-medium mb-2">
                  Onderwerp van het hoofdstuk *
                </label>
                <input
                  type="text"
                  id="onderwerp"
                  value={onderwerp}
                  onChange={(e) => setOnderwerp(e.target.value)}
                  placeholder="Bijv. De Franse Revolutie, Fotosynthese, Python programmeren..."
                  className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  required
                />
              </div>

              {/* Leerdoelen */}
              <div>
                <label htmlFor="leerdoelen" className="block text-sm font-medium mb-2">
                  Leerdoelen (optioneel)
                </label>
                <textarea
                  id="leerdoelen"
                  value={leerdoelen}
                  onChange={(e) => setLeerdoelen(e.target.value)}
                  placeholder="Elk leerdoel op een nieuwe regel..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                />
              </div>

              {/* Lengte */}
              <div>
                <label className="block text-sm font-medium mb-2">Lengte</label>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {LENGTES.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => {
                        setLengte(l.value);
                        setWoordenAantal(l.woorden);
                      }}
                      className={`px-4 py-3 rounded-lg border transition-all ${
                        lengte === l.value && !isCustomWoorden
                          ? 'bg-primary text-white border-primary'
                          : lengte === l.value && isCustomWoorden
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-white border-border hover:border-primary'
                      }`}
                    >
                      <span className="font-medium">{l.label}</span>
                      <span className="block text-xs mt-0.5 opacity-75">{l.description}</span>
                    </button>
                  ))}
                </div>

                {/* Slider voor fijnafstemming */}
                <div className="bg-accent rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-secondary">Fijnafstemming:</span>
                    <span className="text-sm font-medium">
                      {woordenAantal} woorden
                      {isCustomWoorden && (
                        <button
                          type="button"
                          onClick={() => setWoordenAantal(WOORDEN_PER_LENGTE[lengte])}
                          className="ml-2 text-xs text-primary hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="4000"
                    step="100"
                    value={woordenAantal}
                    onChange={(e) => setWoordenAantal(parseInt(e.target.value))}
                    className="w-full h-2 bg-white rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-secondary mt-1">
                    <span>400</span>
                    <span>4000</span>
                  </div>
                </div>
              </div>

              {/* Afbeeldingen */}
              <div>
                <label className="block text-sm font-medium mb-2">Afbeeldingen</label>
                <div className="grid grid-cols-3 gap-2">
                  {AFBEELDING_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setAfbeeldingType(type.value)}
                      className={`px-4 py-3 rounded-lg border transition-all ${
                        afbeeldingType === type.value
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white border-border hover:border-primary'
                      }`}
                    >
                      <span className="font-medium">{type.label}</span>
                      <span className="block text-xs mt-0.5 opacity-75">{type.description}</span>
                    </button>
                  ))}
                </div>
                {afbeeldingType === 'ai' && (
                  <label className="flex items-start gap-3 mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg cursor-pointer hover:border-purple-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={laatstePlaatjeInfographic}
                      onChange={(e) => setLaatstePlaatjeInfographic(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-foreground flex items-center gap-2">
                        <span className="text-lg">ĐY"S</span>
                        Laatste afbeelding als infographic
                      </span>
                      <span className="block text-xs text-secondary mt-1">
                        Genereer een gedetailleerde infographic die de kernconcepten van het hoofdstuk visueel samenvat.
                      </span>
                    </div>
                  </label>
                )}
              </div>

              {/* Bronvermelding */}
              <div>
                <label className="flex items-start gap-3 p-4 bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg cursor-pointer hover:border-green-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={metBronnen}
                    onChange={(e) => setMetBronnen(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-foreground flex items-center gap-2">
                      <span className="text-lg">📚</span>
                      Bronvermelding toevoegen
                    </span>
                    <span className="block text-xs text-secondary mt-1">
                      Voeg bronnen toe aan het hoofdstuk. Bronnen worden geverifieerd op echtheid.
                    </span>
                  </div>
                </label>
              </div>

              {/* Submit */}
              <div className="flex flex-col gap-3 pt-4">
                <button
                  type="submit"
                  disabled={!onderwerp.trim()}
                  className="w-full py-3 px-6 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Genereer hoofdstuk
                </button>
              </div>
            </form>
          </div>
        )}

        {(pageState === 'generating' || pageState === 'result') && (
          <div className="space-y-6">
            {/* Status */}
            {(isStreaming || isLoadingImages) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="text-blue-700 text-sm">
                  {isStreaming ? (
                    <>Hoofdstuk wordt gegenereerd...</>
                  ) : isLoadingImages ? (
                    <>Afbeeldingen worden {afbeeldingType === 'ai' ? 'gegenereerd' : 'gezocht'} ({images.length} klaar)...</>
                  ) : null}
                </span>
              </div>
            )}

            {/* Action buttons */}
            {pageState === 'result' && !isStreaming && !isLoadingImages && (
              <>
                {/* Combined action bar with optional checks and save */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  {!savedHoofdstukId ? (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-gray-700 text-sm font-medium">Hoofdstuk gegenereerd</span>
                      <div className="flex items-center gap-2">
                        {/* Quality check button - compact */}
                        <button
                          onClick={handleQualityCheck}
                          className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-xs flex items-center gap-1.5"
                          title="Check op bias, helderheid, didactiek en niveau-geschiktheid"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Kwaliteit
                        </button>

                        {/* Source verification button - compact (only if metBronnen is enabled) */}
                        {metBronnen && (
                          <button
                            onClick={handleVerifySources}
                            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-xs flex items-center gap-1.5"
                            title="Controleer of de bronnen echt bestaan en bereikbaar zijn"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            Bronnen
                          </button>
                        )}

                        {/* Save button - prominent */}
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="px-4 py-1.5 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                          {isSaving ? (
                            <>
                              <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></div>
                              Opslaan...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                              </svg>
                              Opslaan
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-green-700 text-sm font-medium">✓ Hoofdstuk opgeslagen!</span>
                      <Link
                        href={`/handboeken/${handboekId}`}
                        className="px-4 py-1.5 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors text-sm"
                      >
                        Terug naar handboek
                      </Link>
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Chapter display */}
            <ChapterDisplay
              content={content}
              prompt={prompt}
              images={images}
              isStreaming={isStreaming}
            />
          </div>
        )}
      </main>

      {/* Quality Check Modal */}
      {showQualityModal && qualityReport && (
        <QualityFeedbackModal
          report={qualityReport}
          isLoading={isCheckingQuality}
          isImproving={isImproving}
          onClose={() => setShowQualityModal(false)}
          onImprove={handleImprove}
        />
      )}

      {/* Source Verification Modal */}
      <SourceVerificationModal
        isOpen={showSourceModal}
        report={sourceReport}
        isLoading={isVerifyingSources}
        onClose={() => setShowSourceModal(false)}
        onAccept={() => setShowSourceModal(false)}
        onRetry={handleRetryGeneration}
        onRemoveBadSources={handleRemoveBadSources}
      />
    </div>
  );
}
