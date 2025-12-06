'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ShareHandboekProps {
  handboekId: string;
  isPubliek: boolean;
  publiekeSlug: string | null;
  onUpdate: (isPubliek: boolean, slug: string | null) => void;
}

function generateSlug(): string {
  // Genereer een unieke slug van 8 karakters
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

export default function ShareHandboek({
  handboekId,
  isPubliek,
  publiekeSlug,
  onUpdate,
}: ShareHandboekProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicUrl = publiekeSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/publiek/${publiekeSlug}`
    : null;

  const handleTogglePubliek = async () => {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    if (isPubliek) {
      // Maak privé
      const { error: updateError } = await supabase
        .from('handboeken')
        .update({ is_publiek: false, publieke_slug: null })
        .eq('id', handboekId);

      if (updateError) {
        console.error('Error making private:', updateError);
        setError('Kon handboek niet privé maken');
      } else {
        onUpdate(false, null);
      }
    } else {
      // Maak publiek met nieuwe slug
      const newSlug = generateSlug();
      const { error: updateError } = await supabase
        .from('handboeken')
        .update({ is_publiek: true, publieke_slug: newSlug })
        .eq('id', handboekId);

      if (updateError) {
        console.error('Error making public:', updateError);
        // Probeer opnieuw met andere slug bij conflict
        if (updateError.code === '23505') {
          const retrySlug = generateSlug();
          const { error: retryError } = await supabase
            .from('handboeken')
            .update({ is_publiek: true, publieke_slug: retrySlug })
            .eq('id', handboekId);

          if (retryError) {
            setError('Kon handboek niet delen. Probeer opnieuw.');
          } else {
            onUpdate(true, retrySlug);
          }
        } else {
          setError('Kon handboek niet delen');
        }
      } else {
        onUpdate(true, newSlug);
      }
    }

    setIsLoading(false);
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback voor browsers zonder clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = publicUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Share button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-border rounded-lg hover:bg-accent transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        {isPubliek ? 'Gedeeld' : 'Delen'}
        {isPubliek && (
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        )}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Handboek delen</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-secondary hover:text-foreground"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Toggle publiek */}
              <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Publiek delen</p>
                  <p className="text-sm text-secondary">
                    {isPubliek
                      ? 'Iedereen met de link kan dit handboek bekijken'
                      : 'Maak een deelbare link aan'}
                  </p>
                </div>
                <button
                  onClick={handleTogglePubliek}
                  disabled={isLoading}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isPubliek ? 'bg-green-500' : 'bg-gray-300'
                  } ${isLoading ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      isPubliek ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Link kopiëren */}
              {isPubliek && publicUrl && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Deelbare link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={publicUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-accent border border-border rounded-lg text-sm text-foreground"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        copied
                          ? 'bg-green-500 text-white'
                          : 'bg-primary text-white hover:bg-primary-hover'
                      }`}
                    >
                      {copied ? (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Gekopieerd
                        </span>
                      ) : (
                        'Kopieer'
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-secondary">
                    Deel deze link met anderen om je handboek te tonen.
                  </p>
                </div>
              )}

              {/* Preview link */}
              {isPubliek && publicUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-accent border border-border rounded-lg text-sm text-foreground hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Bekijk publieke pagina
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
