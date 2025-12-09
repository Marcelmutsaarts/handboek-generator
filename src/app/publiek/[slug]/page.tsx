import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Create a lightweight Supabase client for server-side use
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const supabase = getSupabaseClient();

  const { data: handboek } = await supabase
    .from('handboeken')
    .select('titel, beschrijving')
    .eq('publieke_slug', slug)
    .eq('is_publiek', true)
    .single();

  if (!handboek) {
    return { title: 'Handboek niet gevonden' };
  }

  return {
    title: handboek.titel,
    description: handboek.beschrijving || `Handboek: ${handboek.titel}`,
  };
}

export default async function PubliekHandboekPage({ params }: PageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  const supabase = getSupabaseClient();

  // Check of handboek publiek is
  const { data: handboekData, error: handboekError } = await supabase
    .from('handboeken')
    .select('id, titel')
    .eq('publieke_slug', slug)
    .eq('is_publiek', true)
    .single();

  if (handboekError || !handboekData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Handboek niet gevonden</h1>
          <p className="text-gray-600 mb-6">Dit handboek bestaat niet of is niet publiek gedeeld.</p>
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

  // Fetch HTML direct uit Supabase Storage (server-side, veel sneller)
  const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/publiek-handboeken/${slug}.html`;

  let htmlContent: string | null = null;
  let fetchError: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(storageUrl, {
      signal: controller.signal,
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      htmlContent = await response.text();
    } else {
      fetchError = `HTTP ${response.status}`;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      fetchError = 'Timeout bij laden';
    } else {
      fetchError = 'Kon bestand niet laden';
    }
  }

  if (!htmlContent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Handboek tijdelijk niet beschikbaar</h1>
          <p className="text-gray-600 mb-2">
            Er ging iets mis bij het laden van dit handboek.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {fetchError && `(${fetchError})`} Vraag de eigenaar om het opnieuw te delen.
          </p>
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

  // Render de statische HTML direct - server-side, geen JS nodig
  return (
    <div
      dangerouslySetInnerHTML={{ __html: htmlContent }}
      style={{ minHeight: '100vh' }}
    />
  );
}
