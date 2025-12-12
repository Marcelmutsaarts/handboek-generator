'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import InputForm from '@/components/InputForm';
import ChapterDisplay from '@/components/ChapterDisplay';
import Header from '@/components/Header';
import { FormData, ChapterImage, AfbeeldingType } from '@/types';
import { getApiKeyHeader } from '@/hooks/useApiKey';
import { consumeSSEFromReader } from '@/lib/sseClient';

type AppState = 'input' | 'generating' | 'result';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('input');
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<ChapterImage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageType, setImageType] = useState<AfbeeldingType>('geen');
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [onderwerp, setOnderwerp] = useState('');
  const lastFlushRef = useRef(0);

  const handleSubmit = async (formData: FormData) => {
    setAppState('generating');
    setContent('');
    setPrompt('');
    setImages([]);
    setError(null);
    setIsStreaming(true);
    setImageType(formData.afbeeldingType);
    setOnderwerp(formData.onderwerp);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeader(),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Generatie mislukt');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Geen response stream');

      lastFlushRef.current = performance.now();
      let fullContent = '';
      const flushContent = () => {
        setContent(fullContent);
        lastFlushRef.current = performance.now();
      };

      await consumeSSEFromReader(reader, (data) => {
        if (data.type === 'prompt') {
          setPrompt(data.content);
          return;
        }

        if (data.type === 'content') {
          fullContent += data.content || '';
          const now = performance.now();
          if (now - lastFlushRef.current > 120) {
            flushContent();
          }
          return;
        }

        if (data.type === 'done') {
          flushContent();
          setIsStreaming(false);
          setAppState('result');

          // Fetch images based on type
          if (formData.afbeeldingType === 'stock') {
            fetchStockImages(fullContent);
          } else if (formData.afbeeldingType === 'ai') {
            fetchAiImages(fullContent, formData.onderwerp, formData.laatstePlaatjeInfographic);
          }
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
      setIsStreaming(false);
      setAppState('input');
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

  const fetchStockImages = async (generatedContent: string) => {
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
        setImages(data.images);
      }
    } catch (err) {
      console.error('Error fetching stock images:', err);
    } finally {
      setIsLoadingImages(false);
    }
  };

  const fetchAiImages = async (generatedContent: string, onderwerp: string, withInfographic: boolean) => {
    const searchTerms = extractImageTerms(generatedContent);
    if (searchTerms.length === 0 && !withInfographic) return;

    setIsLoadingImages(true);
    const generatedImages: ChapterImage[] = [];

    // Generate regular images concurrently (capped)
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
              generatedImages.push({
                url: data.imageUrl,
                alt: data.alt || term,
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
      console.log('=== Generating Infographic ===');
      console.log('Content length:', generatedContent.length);
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

        console.log('Infographic response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('Infographic data:', data);
          if (data.imageUrl) {
            generatedImages.push({
              url: data.imageUrl,
              alt: `Infographic: ${onderwerp}`,
              isAiGenerated: true,
            });
            setImages([...generatedImages]);
          }
        } else {
          const errorText = await response.text();
          console.error('Infographic generation failed:', errorText);
        }
      } catch (err) {
        console.error('Error generating infographic:', err);
      }
    } else {
      console.log('Infographic not requested (withInfographic:', withInfographic, ')');
    }

    setIsLoadingImages(false);
  };

  const handleReset = () => {
    setAppState('input');
    setContent('');
    setPrompt('');
    setImages([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {appState === 'input' && (
          <div className="space-y-8">
            {/* Nieuw handboek CTA */}
            <div className="bg-gradient-to-r from-primary to-blue-600 rounded-xl p-6 text-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold mb-2">
                    Nieuw handboek aanmaken
                  </h2>
                  <p className="text-blue-100 text-sm">
                    Laat AI een complete hoofdstukindeling genereren en bouw stap voor stap je handboek op.
                  </p>
                </div>
                <Link
                  href="/handboeken/nieuw"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-primary font-medium rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Start nieuw handboek
                </Link>
              </div>
            </div>

            {/* Intro */}
            <div className="bg-white rounded-xl p-6 border border-border">
              <h2 className="text-lg font-semibold mb-2">
                Of genereer een los hoofdstuk
              </h2>
              <p className="text-secondary text-sm">
                Kies een onderwerp, selecteer het niveau van je doelgroep, en
                ontvang binnen enkele momenten een volledig uitgewerkt
                hoofdstuk met theorie, voorbeelden en opdrachten.
              </p>
              <div className="mt-4 p-3 bg-accent rounded-lg">
                <p className="text-xs text-secondary">
                  <strong>Transparantie:</strong> Na het genereren kun je de
                  gebruikte prompt bekijken. Zo leer je hoe je dit zelf kunt
                  doen met andere AI-tools.
                </p>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Form */}
            <div className="bg-white rounded-xl p-6 border border-border">
              <InputForm onSubmit={handleSubmit} isLoading={false} />
            </div>
          </div>
        )}

        {(appState === 'generating' || appState === 'result') && (
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-secondary hover:text-foreground transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Nieuw hoofdstuk maken
            </button>

            {/* Status */}
            {(isStreaming || isLoadingImages) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-blue-700 text-sm">
                  {isStreaming ? (
                    <>
                      Hoofdstuk wordt gegenereerd...
                      {imageType !== 'geen' && (
                        imageType === 'ai'
                          ? ' Daarna worden AI-afbeeldingen gegenereerd.'
                          : ' Daarna worden afbeeldingen gezocht.'
                      )}
                    </>
                  ) : isLoadingImages ? (
                    imageType === 'ai'
                      ? `AI-afbeeldingen worden gegenereerd (${images.length} klaar)...`
                      : 'Afbeeldingen worden gezocht...'
                  ) : null}
                </span>
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

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-secondary">
          <p>
            Deze tool laat zien dat iedereen met AI zelf lesmateriaal kan maken.
          </p>
          <p className="mt-1">
            Controleer gegenereerde inhoud altijd op feitelijke juistheid.
          </p>
        </div>
      </footer>
    </div>
  );
}
