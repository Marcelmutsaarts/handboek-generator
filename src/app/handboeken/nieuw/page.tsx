'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { getApiKeyHeader } from '@/hooks/useApiKey';
import { createClient } from '@/lib/supabase/client';
import { Niveau, TemplateType, TemplateSection, LEERJAREN_PER_NIVEAU, HoofdstukPlan, HandboekStructuur } from '@/types';
import TemplateSelector from '@/components/TemplateSelector';
import StructureEditor from '@/components/StructureEditor';

const NIVEAUS: { value: Niveau; label: string; description: string }[] = [
  { value: 'vmbo', label: 'VMBO', description: '12-16 jaar' },
  { value: 'havo', label: 'HAVO', description: '12-17 jaar' },
  { value: 'vwo', label: 'VWO', description: '12-18 jaar' },
  { value: 'mbo', label: 'MBO', description: '16-25 jaar' },
  { value: 'hbo', label: 'HBO', description: '18+ jaar' },
  { value: 'uni', label: 'Universiteit', description: '18+ jaar' },
];

type Step = 'info' | 'structure';

export default function NieuwHandboekPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
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

  const [structuur, setStructuur] = useState<HoofdstukPlan[]>([]);

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

  const handleGenerateStructure = async () => {
    if (!formData.titel.trim()) return;

    setIsGeneratingStructure(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeader(),
        },
        body: JSON.stringify({
          titel: formData.titel,
          beschrijving: formData.beschrijving || formData.titel,
          niveau: formData.niveau,
          leerjaar: formData.leerjaar,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Structuur genereren mislukt');
      }

      const data = await response.json();
      setStructuur(data.structuur);
      setStep('structure');
    } catch (err) {
      console.error('Error generating structure:', err);
      setError('Kon hoofdstukindeling niet genereren. Probeer het opnieuw.');
    } finally {
      setIsGeneratingStructure(false);
    }
  };

  const handleSkipStructure = () => {
    setStructuur([]);
    setStep('structure');
  };

  const handleSubmit = async () => {
    if (!formData.titel.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();

    // Bereid structuur voor als die er is
    const handboekStructuur: HandboekStructuur | null = structuur.length > 0
      ? { hoofdstukken: structuur }
      : null;

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
        structuur: handboekStructuur,
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

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`flex items-center gap-2 ${step === 'info' ? 'text-primary' : 'text-secondary'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'info' ? 'bg-primary text-white' : 'bg-accent'
            }`}>
              1
            </span>
            <span className="text-sm font-medium">Basisinfo</span>
          </div>
          <div className="h-px w-8 bg-border" />
          <div className={`flex items-center gap-2 ${step === 'structure' ? 'text-primary' : 'text-secondary'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'structure' ? 'bg-primary text-white' : 'bg-accent'
            }`}>
              2
            </span>
            <span className="text-sm font-medium">Hoofdstukindeling</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 'info' && (
          <div className="bg-white rounded-xl p-6 border border-border">
            <h1 className="text-xl font-bold text-foreground mb-6">Nieuw handboek aanmaken</h1>

            <div className="space-y-6">
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
                  disabled={isGeneratingStructure}
                />
              </div>

              {/* Beschrijving */}
              <div>
                <label htmlFor="beschrijving" className="block text-sm font-medium mb-2">
                  Beschrijving / Scope van het handboek
                </label>
                <textarea
                  id="beschrijving"
                  value={formData.beschrijving}
                  onChange={(e) => setFormData({ ...formData, beschrijving: e.target.value })}
                  placeholder="Beschrijf wat het handboek moet behandelen. Bijv.: Een compleet overzicht van de Tweede Wereldoorlog, met focus op oorzaken, verloop en gevolgen. Inclusief de rol van Nederland..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                  disabled={isGeneratingStructure}
                />
                <p className="text-xs text-secondary mt-1">
                  Hoe specifieker je beschrijving, hoe beter de AI een passende hoofdstukindeling kan genereren
                </p>
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
                    disabled={isGeneratingStructure}
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
                    disabled={isGeneratingStructure}
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
                  disabled={isGeneratingStructure}
                />
              </div>

              {/* Template */}
              <TemplateSelector
                value={formData.template}
                customSecties={formData.customSecties}
                onChange={(template, customSecties) =>
                  setFormData({ ...formData, template, customSecties })
                }
                disabled={isGeneratingStructure}
              />

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleGenerateStructure}
                  disabled={isGeneratingStructure || !formData.titel.trim()}
                  className="w-full py-3 px-6 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGeneratingStructure ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Hoofdstukindeling genereren...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Genereer hoofdstukindeling met AI
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSkipStructure}
                  disabled={isGeneratingStructure || !formData.titel.trim()}
                  className="w-full py-3 px-6 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Overslaan, zelf hoofdstukken toevoegen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Structure */}
        {step === 'structure' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-border">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold text-foreground">{formData.titel}</h1>
                  <p className="text-sm text-secondary mt-1">
                    {NIVEAUS.find(n => n.value === formData.niveau)?.label} - Jaar {formData.leerjaar}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('info')}
                  className="text-sm text-primary hover:underline"
                >
                  Wijzig
                </button>
              </div>

              {formData.beschrijving && (
                <p className="text-sm text-secondary border-t border-border pt-4">
                  {formData.beschrijving}
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Hoofdstukindeling
                  {structuur.length > 0 && (
                    <span className="text-sm font-normal text-secondary ml-2">
                      ({structuur.length} hoofdstukken)
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={handleGenerateStructure}
                  disabled={isGeneratingStructure}
                  className="text-sm text-primary hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  {isGeneratingStructure ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                      Genereren...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Opnieuw genereren
                    </>
                  )}
                </button>
              </div>

              {structuur.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-secondary mb-4">
                    Geen hoofdstukindeling gegenereerd. Je kunt zelf hoofdstukken toevoegen of een indeling laten genereren.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-secondary mb-4">
                  Pas de indeling aan: sleep om te herordenen, of bewerk/verwijder hoofdstukken.
                </p>
              )}

              <StructureEditor
                structuur={structuur}
                onChange={setStructuur}
                disabled={isGeneratingStructure || isSubmitting}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('info')}
                disabled={isSubmitting}
                className="px-6 py-3 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
              >
                Terug
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
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
          </div>
        )}
      </main>
    </div>
  );
}
