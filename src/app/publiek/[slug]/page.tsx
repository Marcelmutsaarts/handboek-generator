'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Handboek, Hoofdstuk, Afbeelding } from '@/types';
import { parseMarkdown } from '@/lib/export';

const NIVEAU_LABELS: Record<string, string> = {
  vmbo: 'VMBO',
  havo: 'HAVO',
  vwo: 'VWO',
  mbo: 'MBO',
  hbo: 'HBO',
  uni: 'Universiteit',
};

export default function PubliekHandboekPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [handboek, setHandboek] = useState<Handboek | null>(null);
  const [hoofdstukken, setHoofdstukken] = useState<Hoofdstuk[]>([]);
  const [afbeeldingenPerHoofdstuk, setAfbeeldingenPerHoofdstuk] = useState<Record<string, Afbeelding[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;

      const supabase = createClient();

      // Fetch publiek handboek by slug
      const { data: handboekData, error: handboekError } = await supabase
        .from('handboeken')
        .select('*')
        .eq('publieke_slug', slug)
        .eq('is_publiek', true)
        .single();

      if (handboekError || !handboekData) {
        setError('Dit handboek bestaat niet of is niet publiek gedeeld.');
        setIsLoading(false);
        return;
      }

      setHandboek(handboekData);

      // Fetch hoofdstukken
      const { data: hoofdstukkenData } = await supabase
        .from('hoofdstukken')
        .select('*')
        .eq('handboek_id', handboekData.id)
        .order('volgorde', { ascending: true });

      if (hoofdstukkenData) {
        setHoofdstukken(hoofdstukkenData);

        // Fetch afbeeldingen
        if (hoofdstukkenData.length > 0) {
          const hoofdstukIds = hoofdstukkenData.map((h) => h.id);
          const { data: afbeeldingenData, error: afbeeldingenError } = await supabase
            .from('afbeeldingen')
            .select('*')
            .in('hoofdstuk_id', hoofdstukIds)
            .order('volgorde', { ascending: true });

          if (afbeeldingenError) {
            console.error('Error fetching afbeeldingen:', afbeeldingenError);
          }

          if (afbeeldingenData) {
            console.log('Afbeeldingen gevonden:', afbeeldingenData.length);
            const grouped: Record<string, Afbeelding[]> = {};
            afbeeldingenData.forEach((afb) => {
              if (!grouped[afb.hoofdstuk_id]) {
                grouped[afb.hoofdstuk_id] = [];
              }
              grouped[afb.hoofdstuk_id].push(afb);
            });
            setAfbeeldingenPerHoofdstuk(grouped);
          }
        }
      }

      setIsLoading(false);
    };

    fetchData();
  }, [slug]);

  const handlePrint = () => {
    window.print();
  };

  const renderChapterContent = (hoofdstuk: Hoofdstuk, index: number) => {
    const afbeeldingen = afbeeldingenPerHoofdstuk[hoofdstuk.id] || [];
    const parts = hoofdstuk.content.split(/\[AFBEELDING:\s*([^\]]+)\]/g);
    let imageIndex = 0;

    return (
      <article key={hoofdstuk.id} id={`hoofdstuk-${index + 1}`} className="chapter">
        <div className="chapter-number">Hoofdstuk {index + 1}</div>
        {parts.map((part, partIndex) => {
          if (partIndex % 2 === 0) {
            return (
              <div
                key={partIndex}
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(part) }}
              />
            );
          } else {
            const image = afbeeldingen[imageIndex];
            imageIndex++;
            if (image) {
              return (
                <figure key={partIndex} className="my-6">
                  <img
                    src={image.url}
                    alt={image.alt || ''}
                    className="max-w-full rounded-lg"
                  />
                  <figcaption className="text-xs text-gray-500 mt-2">
                    {image.is_ai_generated
                      ? 'AI-gegenereerde afbeelding'
                      : `Foto: ${image.photographer}`}
                  </figcaption>
                </figure>
              );
            }
            return null;
          }
        })}
      </article>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !handboek) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Handboek niet gevonden</h1>
          <p className="text-gray-600 mb-6">{error || 'Dit handboek bestaat niet of is niet publiek gedeeld.'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Naar Handboek Generator
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header bar - hidden when printing */}
      <div className="print:hidden sticky top-0 bg-white border-b border-gray-200 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Handboek Generator"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm text-gray-600 font-medium truncate max-w-xs">
              {handboek.titel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {hoofdstukken.length} hoofdstuk{hoofdstukken.length !== 1 ? 'ken' : ''}
            </span>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Printen
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="print-content">
        {/* Cover page */}
        <div className="cover-page">
          <div className="cover-content">
            <h1 className="cover-title">{handboek.titel}</h1>
            {handboek.beschrijving && (
              <p className="cover-description">{handboek.beschrijving}</p>
            )}
            <div className="cover-meta">
              <p>{NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Leerjaar {handboek.leerjaar}</p>
              {handboek.context && <p className="cover-context">{handboek.context}</p>}
            </div>
          </div>
        </div>

        {/* Table of contents */}
        {hoofdstukken.length > 0 && (
          <div className="toc-page">
            <h2 className="toc-title">Inhoudsopgave</h2>
            <nav className="toc-list">
              {hoofdstukken.map((hoofdstuk, index) => (
                <a
                  key={hoofdstuk.id}
                  href={`#hoofdstuk-${index + 1}`}
                  className="toc-item"
                >
                  <span className="toc-number">{index + 1}</span>
                  <span className="toc-chapter-title">{hoofdstuk.titel}</span>
                  <span className="toc-dots"></span>
                </a>
              ))}
            </nav>
          </div>
        )}

        {/* Chapters */}
        <div className="chapters">
          {hoofdstukken.map((hoofdstuk, index) => renderChapterContent(hoofdstuk, index))}
        </div>

        {/* Footer - only on screen */}
        <div className="print:hidden py-12 text-center border-t border-gray-200 mt-12">
          <p className="text-sm text-gray-500">
            Gemaakt met{' '}
            <Link href="/" className="text-blue-600 hover:underline">
              Handboek Generator
            </Link>
          </p>
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        /* Screen styles */
        .print-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          font-family: Georgia, 'Times New Roman', serif;
          line-height: 1.8;
          color: #1a1a1a;
        }

        .cover-page {
          min-height: 70vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 4rem 2rem;
          border-bottom: 2px solid #e5e7eb;
          margin-bottom: 3rem;
        }

        .cover-title {
          font-size: 3rem;
          font-weight: bold;
          margin-bottom: 1.5rem;
          color: #111827;
        }

        .cover-description {
          font-size: 1.25rem;
          color: #4b5563;
          margin-bottom: 2rem;
          max-width: 600px;
        }

        .cover-meta {
          font-size: 1rem;
          color: #6b7280;
        }

        .cover-context {
          font-style: italic;
          margin-top: 0.5rem;
        }

        .toc-page {
          padding: 2rem 0;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 3rem;
        }

        .toc-title {
          font-size: 1.75rem;
          font-weight: bold;
          margin-bottom: 2rem;
          color: #111827;
        }

        .toc-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .toc-item {
          display: flex;
          align-items: baseline;
          gap: 1rem;
          text-decoration: none;
          color: #374151;
          padding: 0.5rem 0;
          transition: color 0.2s;
        }

        .toc-item:hover {
          color: #2563eb;
        }

        .toc-number {
          font-weight: 600;
          min-width: 2rem;
        }

        .toc-chapter-title {
          flex-shrink: 0;
        }

        .toc-dots {
          flex: 1;
          border-bottom: 1px dotted #d1d5db;
          margin: 0 0.5rem;
          min-width: 2rem;
        }

        .chapter {
          margin-bottom: 4rem;
          padding-top: 2rem;
        }

        .chapter-number {
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #6b7280;
          margin-bottom: 0.5rem;
        }

        .chapter h1 {
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 1.5rem;
          color: #111827;
        }

        .chapter h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          color: #1f2937;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }

        .chapter h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          color: #374151;
        }

        .chapter p {
          margin-bottom: 1rem;
        }

        .chapter ul, .chapter ol {
          margin: 1rem 0;
          padding-left: 2rem;
        }

        .chapter li {
          margin-bottom: 0.5rem;
        }

        .chapter figure {
          margin: 2rem 0;
        }

        .chapter img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
        }

        /* Print styles */
        @media print {
          @page {
            size: A4;
            margin: 2cm;
          }

          body {
            font-size: 11pt;
          }

          .print-content {
            max-width: none;
            padding: 0;
          }

          .cover-page {
            min-height: auto;
            height: 100vh;
            page-break-after: always;
            border-bottom: none;
            margin-bottom: 0;
          }

          .cover-title {
            font-size: 28pt;
          }

          .cover-description {
            font-size: 14pt;
          }

          .toc-page {
            page-break-after: always;
            border-bottom: none;
            margin-bottom: 0;
          }

          .toc-item {
            color: #000;
          }

          .chapter {
            page-break-before: always;
            margin-bottom: 0;
          }

          .chapter:first-child {
            page-break-before: auto;
          }

          .chapter h1 {
            font-size: 18pt;
          }

          .chapter h2 {
            font-size: 14pt;
            page-break-after: avoid;
          }

          .chapter h3 {
            font-size: 12pt;
            page-break-after: avoid;
          }

          .chapter figure {
            page-break-inside: avoid;
          }

          .chapter img {
            max-width: 80%;
            max-height: 300px;
            object-fit: contain;
          }

          a {
            color: inherit;
            text-decoration: none;
          }
        }
      `}</style>
    </>
  );
}
