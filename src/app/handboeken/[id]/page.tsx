'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import ShareHandboek from '@/components/ShareHandboek';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Handboek, Hoofdstuk, Afbeelding, getTemplate, HoofdstukPlan } from '@/types';
import { exportHandboekAsWord, exportHandboekAsHTML, exportHandboekAsMarkdown } from '@/lib/export';
import StructureEditor from '@/components/StructureEditor';
import { getApiKeyHeader } from '@/hooks/useApiKey';

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
  const [isSavingStructure, setIsSavingStructure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStructure, setShowStructure] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

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

  // Bereken welke geplande hoofdstukken al gegenereerd zijn
  const getStructuurWithProgress = (): HoofdstukPlan[] => {
    if (!handboek?.structuur?.hoofdstukken) return [];

    return handboek.structuur.hoofdstukken.map(plan => {
      // Check of er al een hoofdstuk bestaat met een vergelijkbare titel
      const matchingHoofdstuk = hoofdstukken.find(h =>
        h.titel.toLowerCase().trim() === plan.titel.toLowerCase().trim() ||
        h.onderwerp.toLowerCase().includes(plan.titel.toLowerCase().trim())
      );

      if (matchingHoofdstuk) {
        return { ...plan, status: 'generated' as const, hoofdstukId: matchingHoofdstuk.id };
      }
      return plan;
    });
  };

  const handleSaveStructure = async (newStructuur: HoofdstukPlan[]) => {
    if (!handboek) return;

    setIsSavingStructure(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('handboeken')
      .update({ structuur: { hoofdstukken: newStructuur } })
      .eq('id', handboekId);

    if (error) {
      console.error('Error saving structure:', error);
      setError('Kon structuur niet opslaan');
    } else {
      setHandboek({ ...handboek, structuur: { hoofdstukken: newStructuur } });
    }

    setIsSavingStructure(false);
  };

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

  const handleGenerateCover = async () => {
    if (!handboek) return;
    setIsGeneratingCover(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-cover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeader(),
        },
        body: JSON.stringify({
          titel: handboek.titel,
          beschrijving: handboek.beschrijving,
          niveau: NIVEAU_LABELS[handboek.niveau] || handboek.niveau,
          context: handboek.context,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Cover generatie mislukt');
      }

      const { coverUrl } = await response.json();

      // Opslaan in database
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('handboeken')
        .update({ cover_url: coverUrl })
        .eq('id', handboekId);

      if (updateError) {
        console.error('Error saving cover:', updateError);
        setError('Kon cover niet opslaan');
      } else {
        setHandboek({ ...handboek, cover_url: coverUrl });
      }
    } catch (err) {
      console.error('Cover generation error:', err);
      setError(err instanceof Error ? err.message : 'Cover generatie mislukt');
    }

    setIsGeneratingCover(false);
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
          <div className="flex gap-6">
            {/* Cover afbeelding */}
            <div className="flex-shrink-0">
              {handboek.cover_url ? (
                <div className="relative group">
                  <img
                    src={handboek.cover_url}
                    alt={`Cover van ${handboek.titel}`}
                    className="w-32 h-44 object-cover rounded-lg shadow-md"
                  />
                  <button
                    onClick={handleGenerateCover}
                    disabled={isGeneratingCover}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                  >
                    <span className="text-white text-xs">Opnieuw genereren</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateCover}
                  disabled={isGeneratingCover}
                  className="w-32 h-44 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-accent/50 transition-colors"
                >
                  {isGeneratingCover ? (
                    <>
                      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                      <span className="text-xs text-secondary">Genereren...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-secondary text-center px-2">Genereer kaft</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Handboek info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground mb-2">{handboek.titel}</h1>
              {handboek.beschrijving && (
                <div className="mb-4">
                  {handboek.beschrijving.length > 150 && !showFullDescription ? (
                    <p className="text-secondary text-sm">
                      {handboek.beschrijving.slice(0, 150).trim()}...{' '}
                      <button
                        onClick={() => setShowFullDescription(true)}
                        className="text-primary hover:underline"
                      >
                        meer tonen
                      </button>
                    </p>
                  ) : (
                    <p className="text-secondary text-sm">
                      {handboek.beschrijving}
                      {handboek.beschrijving.length > 150 && (
                        <>
                          {' '}
                          <button
                            onClick={() => setShowFullDescription(false)}
                            className="text-primary hover:underline"
                          >
                            minder tonen
                          </button>
                        </>
                      )}
                    </p>
                  )}
                </div>
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
              <div className="flex items-center gap-3 mt-4">
                <ShareHandboek
                  handboek={handboek}
                  hoofdstukken={hoofdstukken}
                  afbeeldingenPerHoofdstuk={afbeeldingenPerHoofdstuk}
                  onUpdate={(isPubliek, slug) => {
                    setHandboek({ ...handboek, is_publiek: isPubliek, publieke_slug: slug });
                  }}
                />
                <button
                  onClick={handleDeleteHandboek}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Verwijderen
                </button>
              </div>
            </div>
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

        {/* Structuur sectie - alleen tonen als er een structuur is */}
        {handboek.structuur && handboek.structuur.hoofdstukken.length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-border mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  Hoofdstukindeling
                  {isSavingStructure && (
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                  )}
                </h2>
                <p className="text-sm text-secondary mt-1">
                  {(() => {
                    const structuurWithProgress = getStructuurWithProgress();
                    const generated = structuurWithProgress.filter(h => h.status === 'generated').length;
                    const total = structuurWithProgress.length;
                    return `${generated} van ${total} hoofdstukken gegenereerd`;
                  })()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStructure(!showStructure)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {showStructure ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Verbergen
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Bekijken & bewerken
                  </>
                )}
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-accent rounded-full overflow-hidden mb-3">
              {(() => {
                const structuurWithProgress = getStructuurWithProgress();
                const generated = structuurWithProgress.filter(h => h.status === 'generated').length;
                const total = structuurWithProgress.length;
                const percentage = total > 0 ? (generated / total) * 100 : 0;
                return (
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                );
              })()}
            </div>

            {/* Compacte preview als ingeklapt */}
            {!showStructure && (
              <div className="text-sm text-secondary">
                {(() => {
                  const structuur = getStructuurWithProgress();
                  const preview = structuur.slice(0, 3);
                  const rest = structuur.length - 3;
                  return (
                    <span>
                      {preview.map((h, i) => (
                        <span key={h.id}>
                          <span className={h.status === 'generated' ? 'text-green-600' : ''}>
                            {h.titel}
                          </span>
                          {i < preview.length - 1 && ' · '}
                        </span>
                      ))}
                      {rest > 0 && <span className="text-secondary/60"> +{rest} meer</span>}
                    </span>
                  );
                })()}
              </div>
            )}

            {showStructure && (
              <div className="mt-6 pt-6 border-t border-border">
                <StructureEditor
                  structuur={getStructuurWithProgress()}
                  onChange={handleSaveStructure}
                  disabled={isSavingStructure}
                />
                <p className="text-xs text-secondary mt-4">
                  Klik op &quot;Nieuw hoofdstuk&quot; om een gepland hoofdstuk te genereren. Gegenereerde hoofdstukken worden automatisch gekoppeld aan het plan.
                </p>
              </div>
            )}
          </div>
        )}

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
              {handboek.structuur && handboek.structuur.hoofdstukken.length > 0
                ? `Er zijn ${handboek.structuur.hoofdstukken.length} hoofdstukken gepland. Genereer je eerste hoofdstuk.`
                : 'Voeg je eerste hoofdstuk toe aan dit handboek.'}
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
