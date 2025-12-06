'use client';

import { useState, useEffect } from 'react';
import { FormData, Niveau, Lengte, AfbeeldingType, TemplateType, TemplateSection, LEERJAREN_PER_NIVEAU, WOORDEN_PER_LENGTE } from '@/types';
import TemplateSelector from './TemplateSelector';

interface InputFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
}

const NIVEAUS: { value: Niveau; label: string; description: string }[] = [
  { value: 'vmbo', label: 'VMBO', description: '12-16 jaar' },
  { value: 'havo', label: 'HAVO', description: '12-17 jaar' },
  { value: 'vwo', label: 'VWO', description: '12-18 jaar' },
  { value: 'mbo', label: 'MBO', description: '16-25 jaar' },
  { value: 'hbo', label: 'HBO', description: '18+ jaar' },
  { value: 'uni', label: 'Universiteit', description: '18+ jaar' },
];

const LENGTES: { value: Lengte; label: string; description: string }[] = [
  { value: 'kort', label: 'Kort', description: '~800 woorden' },
  { value: 'medium', label: 'Medium', description: '~1500 woorden' },
  { value: 'lang', label: 'Lang', description: '~2500 woorden' },
];

const AFBEELDING_TYPES: { value: AfbeeldingType; label: string; description: string }[] = [
  { value: 'geen', label: 'Geen', description: 'Alleen tekst' },
  { value: 'stock', label: 'Stockfoto\'s', description: 'Via Pexels' },
  { value: 'ai', label: 'AI-gegenereerd', description: 'Via Gemini' },
];

export default function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [formData, setFormData] = useState<FormData>({
    onderwerp: '',
    niveau: 'havo',
    leerjaar: 1,
    leerdoelen: '',
    lengte: 'medium',
    woordenAantal: WOORDEN_PER_LENGTE.medium,
    metAfbeeldingen: true,
    afbeeldingType: 'stock',
    context: '',
    template: 'klassiek',
    customSecties: [],
  });

  // Bepaal of de slider afwijkt van de preset
  const isCustomWoorden = formData.woordenAantal !== WOORDEN_PER_LENGTE[formData.lengte];

  // Update leerjaar when niveau changes (reset to 1 if current leerjaar is not valid)
  useEffect(() => {
    const beschikbareLeerjaren = LEERJAREN_PER_NIVEAU[formData.niveau];
    if (!beschikbareLeerjaren.includes(formData.leerjaar)) {
      setFormData(prev => ({ ...prev, leerjaar: 1 }));
    }
  }, [formData.niveau, formData.leerjaar]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.onderwerp.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Onderwerp */}
      <div>
        <label htmlFor="onderwerp" className="block text-sm font-medium mb-2">
          Onderwerp van het hoofdstuk *
        </label>
        <input
          type="text"
          id="onderwerp"
          value={formData.onderwerp}
          onChange={(e) => setFormData({ ...formData, onderwerp: e.target.value })}
          placeholder="Bijv. De Franse Revolutie, Fotosynthese, Python programmeren..."
          className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          required
          disabled={isLoading}
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
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
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
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
          >
            {LEERJAREN_PER_NIVEAU[formData.niveau].map((jaar) => (
              <option key={jaar} value={jaar}>
                Jaar {jaar}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leerdoelen */}
      <div>
        <label htmlFor="leerdoelen" className="block text-sm font-medium mb-2">
          Leerdoelen (optioneel)
        </label>
        <textarea
          id="leerdoelen"
          value={formData.leerdoelen}
          onChange={(e) => setFormData({ ...formData, leerdoelen: e.target.value })}
          placeholder="Elk leerdoel op een nieuwe regel, bijv.:&#10;De oorzaken van de Franse Revolutie kunnen uitleggen&#10;De belangrijkste gebeurtenissen kunnen benoemen&#10;De gevolgen voor Europa kunnen analyseren"
          rows={4}
          className="w-full px-4 py-3 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
          disabled={isLoading}
        />
        <p className="text-xs text-secondary mt-1">
          Laat leeg voor automatisch gegenereerde leerdoelen
        </p>
      </div>

      {/* Context / Personalisatie */}
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
          disabled={isLoading}
        />
        <p className="text-xs text-secondary mt-1">
          Voorbeelden en metaforen worden subtiel afgestemd op dit interessegebied
        </p>
      </div>

      {/* Template */}
      <TemplateSelector
        value={formData.template}
        customSecties={formData.customSecties || []}
        onChange={(template, customSecties) =>
          setFormData({ ...formData, template, customSecties })
        }
        disabled={isLoading}
      />

      {/* Lengte */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Lengte van het hoofdstuk
        </label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {LENGTES.map((lengte) => (
            <button
              key={lengte.value}
              type="button"
              onClick={() => setFormData({
                ...formData,
                lengte: lengte.value,
                woordenAantal: WOORDEN_PER_LENGTE[lengte.value]
              })}
              disabled={isLoading}
              className={`px-4 py-3 rounded-lg border transition-all ${
                formData.lengte === lengte.value && !isCustomWoorden
                  ? 'bg-primary text-white border-primary'
                  : formData.lengte === lengte.value && isCustomWoorden
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-white border-border hover:border-primary'
              } disabled:opacity-50`}
            >
              <span className="font-medium">{lengte.label}</span>
              <span className="block text-xs mt-0.5 opacity-75">
                {lengte.description}
              </span>
            </button>
          ))}
        </div>

        {/* Slider voor fijnafstemming */}
        <div className="bg-accent rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-secondary">Fijnafstemming:</span>
            <span className="text-sm font-medium">
              {formData.woordenAantal} woorden
              {isCustomWoorden && (
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    woordenAantal: WOORDEN_PER_LENGTE[formData.lengte]
                  })}
                  className="ml-2 text-xs text-primary hover:underline"
                >
                  Reset
                </button>
              )}
            </span>
          </div>
          <input
            type="range"
            min="400"
            max="4000"
            step="100"
            value={formData.woordenAantal}
            onChange={(e) => setFormData({
              ...formData,
              woordenAantal: parseInt(e.target.value)
            })}
            disabled={isLoading}
            className="w-full h-2 bg-white rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-secondary mt-1">
            <span>400</span>
            <span>4000</span>
          </div>
        </div>
      </div>

      {/* Afbeeldingen */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Afbeeldingen
        </label>
        <div className="grid grid-cols-3 gap-2">
          {AFBEELDING_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setFormData({
                ...formData,
                afbeeldingType: type.value,
                metAfbeeldingen: type.value !== 'geen'
              })}
              disabled={isLoading}
              className={`px-4 py-3 rounded-lg border transition-all ${
                formData.afbeeldingType === type.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white border-border hover:border-primary'
              } disabled:opacity-50`}
            >
              <span className="font-medium">{type.label}</span>
              <span className="block text-xs mt-0.5 opacity-75">
                {type.description}
              </span>
            </button>
          ))}
        </div>
        {formData.afbeeldingType === 'ai' && (
          <p className="text-xs text-secondary mt-2">
            AI-gegenereerde afbeeldingen zijn beter afgestemd op de inhoud, maar genereren duurt langer.
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !formData.onderwerp.trim()}
        className="w-full py-4 px-6 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
            Hoofdstuk wordt gegenereerd...
          </>
        ) : (
          'Genereer hoofdstuk'
        )}
      </button>
    </form>
  );
}
