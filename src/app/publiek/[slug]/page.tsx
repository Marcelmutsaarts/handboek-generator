'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function PubliekHandboekPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;

      const supabase = createClient();

      // Check of handboek publiek is
      const { data: handboekData, error: handboekError } = await supabase
        .from('handboeken')
        .select('id, titel')
        .eq('publieke_slug', slug)
        .eq('is_publiek', true)
        .single();

      if (handboekError || !handboekData) {
        setError('Dit handboek bestaat niet of is niet publiek gedeeld.');
        setIsLoading(false);
        return;
      }

      // Fetch HTML uit Supabase Storage
      const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/publiek-handboeken/${slug}.html`;

      try {
        const response = await fetch(storageUrl);
        if (response.ok) {
          const html = await response.text();
          setHtmlContent(html);
        } else {
          setError('Dit handboek is nog niet beschikbaar. Vraag de eigenaar om het opnieuw te delen.');
        }
      } catch {
        setError('Kon het handboek niet laden.');
      }

      setIsLoading(false);
    };

    fetchData();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !htmlContent) {
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

  // Render de statische HTML direct
  return (
    <div
      dangerouslySetInnerHTML={{ __html: htmlContent }}
      style={{ minHeight: '100vh' }}
    />
  );
}
