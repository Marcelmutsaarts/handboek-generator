'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Niveau, TemplateType, TemplateSection, LEERJAREN_PER_NIVEAU } from '@/types';
import TemplateSelector from '@/components/TemplateSelector';

const NIVEAUS: { value: Niveau; label: string; description: string }[] = [
  { value: 'vmbo', label: 'VMBO', description: '12-16 jaar' },
  { value: 'havo', label: 'HAVO', description: '12-17 jaar' },
  { value: 'vwo', label: 'VWO', description: '12-18 jaar' },
  { value: 'mbo', label: 'MBO', description: '16-25 jaar' },
  { value: 'hbo', label: 'HBO', description: '18+ jaar' },
  { value: 'uni', label: 'Universiteit', description: '18+ jaar' },
];

export default function NieuwHandboekPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    titel: '',
    beschrijving: '',
    niveau: 'havo' as Niveau,
    leerjaar: 1,
    context: '',
    template: 'klassiek' as TemplateType,
    customSecties: [] as TemplateSection[],
  });

  // Update leerjaar when niveau changes (reset to 1 if current leerjaar is not valid)
  useEffect(() => {
    const beschikbareLeerjaren = LEERJAREN_PER_NIVEAU[formData.niveau];
    if (!beschikbareLeerjaren.includes(formData.leerjaar)) {
      setFormData(prev => ({ ...prev, leerjaar: 1 }));
    }
  }, [formData.niveau, formData.leerjaar]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titel.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from('handboeken')
      .insert({
        titel: formData.titel.trim(),
        beschrijving: formData.beschrijving.trim() || null,
        niveau: formData.niveau,
        leerjaar: formData.leerjaar,
        context: formData.context.trim() || null,
        template: formData.template,
        custom_secties: formData.customSecties.length > 0 ? formData.customSecties : null,
        user_id: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating handboek:', error);
      setError('Kon handboek niet aanmaken. Probeer het opnieuw.');
      setIsSubmitting(false);
    } else {
      router.push(`/handboeken/${data.id}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
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

        {/* Form */}
        <div className="bg-white rounded-xl p-6 border border-border">
          <h1 className="text-xl font-bold text-foreground mb-6">Nieuw handboek aanmaken</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Titel */}
            <div>
              <label htmlFor="titel" className="block text-sm font-medium mb-2">
                Titel van het handboek *
              </label>
              <input
                type="text"
                id="titel"
                value={formData.titel}
                onChange={(e) => setFormData({ ...formData, titel: e.target.value })}
                placeholder="Bijv. Geschiedenis van Europa, Biologie voor beginners..."
                className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Beschrijving */}
            <div>
              <label htmlFor="beschrijving" className="block text-sm font-medium mb-2">
                Beschrijving (optioneel)
              </label>
              <textarea
                id="beschrijving"
                value={formData.beschrijving}
                onChange={(e) => setFormData({ ...formData, beschrijving: e.target.value })}
                placeholder="Korte beschrijving van het handboek..."
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                disabled={isSubmitting}
              />
            </div>

            {/* Niveau en Leerjaar */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="niveau" className="block text-sm font-medium mb-2">
                  Niveau / Doelgroep
                </label>
                <select
                  id="niveau"
                  value={formData.niveau}
                  onChange={(e) => setFormData({ ...formData, niveau: e.target.value as Niveau })}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                >
                  {NIVEAUS.map((niveau) => (
                    <option key={niveau.value} value={niveau.value}>
                      {niveau.label} ({niveau.description})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="leerjaar" className="block text-sm font-medium mb-2">
                  Leerjaar
                </label>
                <select
                  id="leerjaar"
                  value={formData.leerjaar}
                  onChange={(e) => setFormData({ ...formData, leerjaar: parseInt(e.target.value) })}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                >
                  {LEERJAREN_PER_NIVEAU[formData.niveau].map((jaar) => (
                    <option key={jaar} value={jaar}>
                      Jaar {jaar}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-secondary -mt-4">
              Dit niveau en leerjaar worden gebruikt voor alle hoofdstukken in dit handboek
            </p>

            {/* Context */}
            <div>
              <label htmlFor="context" className="block text-sm font-medium mb-2">
                Interessegebied voor personalisatie (optioneel)
              </label>
              <input
                type="text"
                id="context"
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                placeholder="Bijv. voetbal, gaming, paarden, muziek, koken..."
                className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                disabled={isSubmitting}
              />
              <p className="text-xs text-secondary mt-1">
                Voorbeelden en metaforen worden subtiel afgestemd op dit interessegebied
              </p>
            </div>

            {/* Template */}
            <TemplateSelector
              value={formData.template}
              customSecties={formData.customSecties}
              onChange={(template, customSecties) =>
                setFormData({ ...formData, template, customSecties })
              }
              disabled={isSubmitting}
            />

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Link
                href="/handboeken"
                className="px-6 py-3 border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Annuleren
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !formData.titel.trim()}
                className="flex-1 py-3 px-6 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Aanmaken...
                  </>
                ) : (
                  'Handboek aanmaken'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
