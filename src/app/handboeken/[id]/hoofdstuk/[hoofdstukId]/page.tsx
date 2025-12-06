'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import ChapterDisplay from '@/components/ChapterDisplay';
import ChapterEditor from '@/components/ChapterEditor';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Handboek, Hoofdstuk, Afbeelding, ChapterImage } from '@/types';

export default function HoofdstukDetailPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const handboekId = params.id as string;
  const hoofdstukId = params.hoofdstukId as string;

  const [handboek, setHandboek] = useState<Handboek | null>(null);
  const [hoofdstuk, setHoofdstuk] = useState<Hoofdstuk | null>(null);
  const [afbeeldingen, setAfbeeldingen] = useState<Afbeelding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !handboekId || !hoofdstukId) return;

      const supabase = createClient();

      // Fetch handboek
      const { data: handboekData, error: handboekError } = await supabase
        .from('handboeken')
        .select('*')
        .eq('id', handboekId)
        .single();

      if (handboekError || !handboekData) {
        setError('Handboek niet gevonden');
        setIsLoading(false);
        return;
      }

      setHandboek(handboekData);

      // Fetch hoofdstuk
      const { data: hoofdstukData, error: hoofdstukError } = await supabase
        .from('hoofdstukken')
        .select('*')
        .eq('id', hoofdstukId)
        .eq('handboek_id', handboekId)
        .single();

      if (hoofdstukError || !hoofdstukData) {
        setError('Hoofdstuk niet gevonden');
        setIsLoading(false);
        return;
      }

      setHoofdstuk(hoofdstukData);

      // Fetch afbeeldingen
      const { data: afbeeldingenData } = await supabase
        .from('afbeeldingen')
        .select('*')
        .eq('hoofdstuk_id', hoofdstukId)
        .order('volgorde', { ascending: true });

      setAfbeeldingen(afbeeldingenData || []);
      setIsLoading(false);
    };

    if (user) {
      fetchData();
    }
  }, [user, handboekId, hoofdstukId]);

  const handleDelete = async () => {
    if (!confirm('Weet je zeker dat je dit hoofdstuk wilt verwijderen?')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('hoofdstukken')
      .delete()
      .eq('id', hoofdstukId);

    if (error) {
      setError('Kon hoofdstuk niet verwijderen');
    } else {
      router.push(`/handboeken/${handboekId}`);
    }
  };

  const handleSave = async (newContent: string) => {
    if (!hoofdstuk) return;

    setIsSaving(true);
    setError(null);

    const supabase = createClient();

    // Extract new title from content (first # heading)
    const titleMatch = newContent.match(/^#\s+(.+)$/m);
    const newTitle = titleMatch ? titleMatch[1] : hoofdstuk.titel;

    const { error: updateError } = await supabase
      .from('hoofdstukken')
      .update({
        content: newContent,
        titel: newTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', hoofdstukId);

    if (updateError) {
      console.error('Error updating hoofdstuk:', updateError);
      setError('Kon wijzigingen niet opslaan');
    } else {
      // Update local state
      setHoofdstuk({ ...hoofdstuk, content: newContent, titel: newTitle });
      setIsEditing(false);
    }

    setIsSaving(false);
  };

  // Convert database afbeeldingen to ChapterImage format
  const images: ChapterImage[] = afbeeldingen.map((afb) => ({
    url: afb.url,
    alt: afb.alt || '',
    photographer: afb.photographer || undefined,
    photographerUrl: afb.photographer_url || undefined,
    isAiGenerated: afb.is_ai_generated,
  }));

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

  if (error || !handboek || !hoofdstuk) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700 mb-4">{error || 'Niet gevonden'}</p>
            <Link href={`/handboeken/${handboekId}`} className="text-primary hover:underline">
              Terug naar handboek
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

        {/* Hoofdstuk header */}
        <div className="bg-white rounded-xl p-6 border border-border mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">{hoofdstuk.titel}</h1>
              <p className="text-secondary text-sm">
                Onderwerp: {hoofdstuk.onderwerp}
              </p>
              <p className="text-secondary text-xs mt-2">
                Aangemaakt: {new Date(hoofdstuk.created_at).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Bewerken
                </button>
              )}
              <button
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Chapter editor or display */}
        {isEditing ? (
          <ChapterEditor
            content={hoofdstuk.content}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
            isSaving={isSaving}
          />
        ) : (
          <ChapterDisplay
            content={hoofdstuk.content}
            prompt={hoofdstuk.prompt_used || ''}
            images={images}
            isStreaming={false}
          />
        )}
      </main>
    </div>
  );
}
