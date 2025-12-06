'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
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

export default function HandboekPreviewPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const handboekId = params.id as string;
  const printRef = useRef<HTMLDivElement>(null);

  const [handboek, setHandboek] = useState<Handboek | null>(null);
  const [hoofdstukken, setHoofdstukken] = useState<Hoofdstuk[]>([]);
  const [afbeeldingenPerHoofdstuk, setAfbeeldingenPerHoofdstuk] = useState<Record<string, Afbeelding[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !handboekId) return;

      const supabase = createClient();

      // Fetch handboek
      const { data: handboekData, error: handboekError } = await supabase
        .from('handboeken')
        .select('*')
        .eq('id', handboekId)
        .single();

      if (handboekError) {
        setError('Handboek niet gevonden');
        setIsLoading(false);
        return;
      }

      setHandboek(handboekData);

      // Fetch hoofdstukken
      const { data: hoofdstukkenData } = await supabase
        .from('hoofdstukken')
        .select('*')
        .eq('handboek_id', handboekId)
        .order('volgorde', { ascending: true });

      if (hoofdstukkenData) {
        setHoofdstukken(hoofdstukkenData);

        // Fetch afbeeldingen
        if (hoofdstukkenData.length > 0) {
          const hoofdstukIds = hoofdstukkenData.map((h) => h.id);
          console.log('Fetching afbeeldingen voor hoofdstukken:', hoofdstukIds);
          const { data: afbeeldingenData, error: afbeeldingenError } = await supabase
            .from('afbeeldingen')
            .select('*')
            .in('hoofdstuk_id', hoofdstukIds)
            .order('volgorde', { ascending: true });

          if (afbeeldingenError) {
            console.error('Error fetching afbeeldingen:', afbeeldingenError);
          }
          console.log('Afbeeldingen gevonden:', afbeeldingenData?.length || 0, afbeeldingenData);

          if (afbeeldingenData) {
            const grouped: Record<string, Afbeelding[]> = {};
            afbeeldingenData.forEach((afb) => {
              if (!grouped[afb.hoofdstuk_id]) {
                grouped[afb.hoofdstuk_id] = [];
              }
              grouped[afb.hoofdstuk_id].push(afb);
            });
            console.log('Grouped afbeeldingen:', grouped);
            setAfbeeldingenPerHoofdstuk(grouped);
          }
        }
      }

      setIsLoading(false);
    };

    if (user) {
      fetchData();
    }
  }, [user, handboekId]);

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

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !handboek) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-red-600 mb-4">{error || 'Handboek niet gevonden'}</p>
          <Link href="/handboeken" className="text-primary hover:underline">
            Terug naar handboeken
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print controls - hidden when printing */}
      <div className="print:hidden sticky top-0 bg-white border-b border-gray-200 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`/handboeken/${handboekId}`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Terug
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {hoofdstukken.length} hoofdstuk{hoofdstukken.length !== 1 ? 'ken' : ''}
            </span>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Printen
            </button>
          </div>
        </div>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="print-content">
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

        {/* Chapters */}
        <div className="chapters">
          {hoofdstukken.map((hoofdstuk, index) => renderChapterContent(hoofdstuk, index))}
        </div>
      </div>

      {/* Print styles */}
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
          min-height: 80vh;
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

          .toc-item:hover {
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
