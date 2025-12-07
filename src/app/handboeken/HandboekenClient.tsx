'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import { Handboek } from '@/types';

const NIVEAU_LABELS: Record<string, string> = {
  vmbo: 'VMBO',
  havo: 'HAVO',
  vwo: 'VWO',
  mbo: 'MBO',
  hbo: 'HBO',
  uni: 'Universiteit',
};

interface HandboekenClientProps {
  handboeken: Handboek[];
  error: string | null;
}

export default function HandboekenClient({ handboeken, error }: HandboekenClientProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mijn Handboeken</h1>
            <p className="text-secondary text-sm mt-1">
              Beheer je handboeken en hoofdstukken
            </p>
          </div>
          <Link
            href="/handboeken/nieuw"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            + Nieuw handboek
          </Link>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {handboeken.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-xl p-12 border border-border text-center">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Nog geen handboeken
            </h2>
            <p className="text-secondary text-sm mb-6">
              Maak je eerste handboek aan om hoofdstukken te gaan genereren en opslaan.
            </p>
            <Link
              href="/handboeken/nieuw"
              className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Maak je eerste handboek
            </Link>
          </div>
        ) : (
          /* Handboeken grid */
          <div className="grid gap-4">
            {handboeken.map((handboek) => (
              <Link
                key={handboek.id}
                href={`/handboeken/${handboek.id}`}
                className="bg-white rounded-xl p-6 border border-border hover:border-primary transition-colors block"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-foreground mb-1">
                      {handboek.titel}
                    </h2>
                    {handboek.beschrijving && (
                      <p className="text-secondary text-sm mb-3 line-clamp-2">
                        {handboek.beschrijving}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-secondary">
                      <span className="px-2 py-1 bg-accent rounded">
                        {NIVEAU_LABELS[handboek.niveau] || handboek.niveau}
                      </span>
                      {handboek.context && (
                        <span className="px-2 py-1 bg-accent rounded">
                          {handboek.context}
                        </span>
                      )}
                      <span>
                        Bijgewerkt: {new Date(handboek.updated_at).toLocaleDateString('nl-NL')}
                      </span>
                    </div>
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
