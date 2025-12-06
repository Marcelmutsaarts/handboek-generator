'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Handboek, Hoofdstuk, Afbeelding, getTemplate } from '@/types';
import { exportHandboekAsWord, exportHandboekAsHTML, exportHandboekAsMarkdown } from '@/lib/export';

const NIVEAU_LABELS: Record<string, string> = {
  vmbo: 'VMBO',
  havo: 'HAVO',
  vwo: 'VWO',
  mbo: 'MBO',
  hbo: 'HBO',
  uni: 'Universiteit',
};

export default function HandboekDetailPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const handboekId = params.id as string;

  const [handboek, setHandboek] = useState<Handboek | null>(null);
  const [hoofdstukken, setHoofdstukken] = useState<Hoofdstuk[]>([]);
  const [afbeeldingenPerHoofdstuk, setAfbeeldingenPerHoofdstuk] = useState<Record<string, Afbeelding[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
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
        console.error('Error fetching handboek:', handboekError);
        setError('Handboek niet gevonden');
        setIsLoading(false);
        return;
      }

      setHandboek(handboekData);

      // Fetch hoofdstukken
      const { data: hoofdstukkenData, error: hoofdstukkenError } = await supabase
        .from('hoofdstukken')
        .select('*')
        .eq('handboek_id', handboekId)
        .order('volgorde', { ascending: true });

      if (hoofdstukkenError) {
        console.error('Error fetching hoofdstukken:', hoofdstukkenError);
      } else {
        setHoofdstukken(hoofdstukkenData || []);

        // Fetch afbeeldingen voor alle hoofdstukken
        if (hoofdstukkenData && hoofdstukkenData.length > 0) {
          const hoofdstukIds = hoofdstukkenData.map((h) => h.id);
          const { data: afbeeldingenData } = await supabase
            .from('afbeeldingen')
            .select('*')
            .in('hoofdstuk_id', hoofdstukIds)
            .order('volgorde', { ascending: true });

          if (afbeeldingenData) {
            // Groepeer afbeeldingen per hoofdstuk
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

    if (user) {
      fetchData();
    }
  }, [user, handboekId]);

  const handleDeleteHandboek = async () => {
    if (!confirm('Weet je zeker dat je dit handboek wilt verwijderen? Alle hoofdstukken worden ook verwijderd.')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('handboeken')
      .delete()
      .eq('id', handboekId);

    if (error) {
      console.error('Error deleting handboek:', error);
      setError('Kon handboek niet verwijderen');
    } else {
      router.push('/handboeken');
    }
  };

  const handleExportWord = async () => {
    if (!handboek || hoofdstukken.length === 0) return;
    setIsExporting(true);
    try {
      await exportHandboekAsWord(handboek, hoofdstukken, afbeeldingenPerHoofdstuk);
    } catch (err) {
      console.error('Export error:', err);
      setError('Export mislukt. Probeer het opnieuw.');
    }
    setIsExporting(false);
  };

  const handleExportHTML = () => {
    if (!handboek || hoofdstukken.length === 0) return;
    try {
      exportHandboekAsHTML(handboek, hoofdstukken, afbeeldingenPerHoofdstuk);
    } catch (err) {
      console.error('Export error:', err);
      setError('Export mislukt. Probeer het opnieuw.');
    }
  };

  const handleExportMarkdown = () => {
    if (!handboek || hoofdstukken.length === 0) return;
    try {
      exportHandboekAsMarkdown(handboek, hoofdstukken);
    } catch (err) {
      console.error('Export error:', err);
      setError('Export mislukt. Probeer het opnieuw.');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error || !handboek) {
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
          href="/handboeken"
          className="flex items-center gap-2 text-secondary hover:text-foreground transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Terug naar handboeken
        </Link>

        {/* Handboek header */}
        <div className="bg-white rounded-xl p-6 border border-border mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">{handboek.titel}</h1>
              {handboek.beschrijving && (
                <p className="text-secondary mb-4">{handboek.beschrijving}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="px-3 py-1 bg-accent rounded-lg">
                  {NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Jaar {handboek.leerjaar}
                </span>
                {handboek.template && (
                  <span className="px-3 py-1 bg-accent rounded-lg flex items-center gap-1.5">
                    <span>{getTemplate(handboek.template)?.icon || '📄'}</span>
                    <span>{getTemplate(handboek.template)?.naam || handboek.template}</span>
                  </span>
                )}
                {handboek.context && (
                  <span className="px-3 py-1 bg-accent rounded-lg">
                    {handboek.context}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleDeleteHandboek}
              className="text-red-600 hover:text-red-700 text-sm"
            >
              Verwijderen
            </button>
          </div>

          {/* Export buttons */}
          {hoofdstukken.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">Exporteer compleet handboek</p>
                <Link
                  href={`/handboeken/${handboekId}/preview`}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Bekijk preview
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExportWord}
                  disabled={isExporting}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Exporteren...
                    </>
                  ) : (
                    'Download Word'
                  )}
                </button>
                <button
                  onClick={handleExportHTML}
                  disabled={isExporting}
                  className="px-4 py-2 text-sm bg-white border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Download HTML
                </button>
                <button
                  onClick={handleExportMarkdown}
                  disabled={isExporting}
                  className="px-4 py-2 text-sm bg-white border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Download Markdown
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hoofdstukken section */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Hoofdstukken ({hoofdstukken.length})
          </h2>
          <Link
            href={`/handboeken/${handboekId}/nieuw-hoofdstuk`}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm"
          >
            + Nieuw hoofdstuk
          </Link>
        </div>

        {hoofdstukken.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-xl p-12 border border-border text-center">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nog geen hoofdstukken
            </h3>
            <p className="text-secondary text-sm mb-6">
              Voeg je eerste hoofdstuk toe aan dit handboek.
            </p>
            <Link
              href={`/handboeken/${handboekId}/nieuw-hoofdstuk`}
              className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Eerste hoofdstuk toevoegen
            </Link>
          </div>
        ) : (
          /* Hoofdstukken list */
          <div className="space-y-3">
            {hoofdstukken.map((hoofdstuk, index) => (
              <Link
                key={hoofdstuk.id}
                href={`/handboeken/${handboekId}/hoofdstuk/${hoofdstuk.id}`}
                className="bg-white rounded-xl p-5 border border-border hover:border-primary transition-colors block"
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-sm font-medium text-secondary">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{hoofdstuk.titel}</h3>
                    <p className="text-sm text-secondary">{hoofdstuk.onderwerp}</p>
                  </div>
                  <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
