'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { generatePublicHTML } from '@/lib/export';
import { Handboek, Hoofdstuk, Afbeelding } from '@/types';

interface ShareHandboekProps {
  handboek: Handboek;
  hoofdstukken: Hoofdstuk[];
  afbeeldingenPerHoofdstuk: Record<string, Afbeelding[]>;
  onUpdate: (isPubliek: boolean, slug: string | null) => void;
}

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

// Compress image before upload (max 1920px width, 80% quality)
async function compressImage(base64: string, maxWidth = 1920, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Scale down if needed
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64); // Fallback to original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG for better compression (unless it's PNG with transparency)
      const mimeType = base64.includes('image/png') ? 'image/png' : 'image/jpeg';
      const compressed = canvas.toDataURL(mimeType, quality);

      // Only use compressed if it's actually smaller
      resolve(compressed.length < base64.length ? compressed : base64);
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = base64;
  });
}

// Convert base64 to blob with validation
function base64ToBlob(base64: string): { blob: Blob; mimeType: string } | null {
  try {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;

    const mimeType = match[1];
    const data = match[2];

    // Validate base64 string
    if (!data || data.length === 0) return null;

    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    return { blob: new Blob([bytes], { type: mimeType }), mimeType };
  } catch (error) {
    console.error('Base64 conversion failed:', error);
    return null;
  }
}

// Fetch external image and convert to blob
async function fetchExternalImage(url: string): Promise<{ blob: Blob; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    return { blob, mimeType };
  } catch (error) {
    console.error('Failed to fetch external image:', error);
    return null;
  }
}

// Upload with retry logic
async function uploadWithRetry(
  supabase: ReturnType<typeof createClient>,
  fileName: string,
  blob: Blob,
  mimeType: string,
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Delete existing file first (ignore errors)
      await supabase.storage.from('publiek-handboeken').remove([fileName]);

      const { error } = await supabase.storage
        .from('publiek-handboeken')
        .upload(fileName, blob, {
          contentType: mimeType,
          cacheControl: '31536000', // 1 year cache for images
          upsert: true,
        });

      if (!error) return true;

      console.warn(`Upload attempt ${attempt} failed for ${fileName}:`, error.message);

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    } catch (error) {
      console.error(`Upload attempt ${attempt} error for ${fileName}:`, error);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
  }
  return false;
}

interface UploadResult {
  originalUrl: string;
  publicUrl: string | null;
  error?: string;
}

export default function ShareHandboek({
  handboek,
  hoofdstukken,
  afbeeldingenPerHoofdstuk,
  onUpdate,
}: ShareHandboekProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPubliek = handboek.is_publiek;
  const publiekeSlug = handboek.publieke_slug;
  const handboekId = handboek.id;
  const supabase = createClient();

  const publicUrl = publiekeSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/publiek/${publiekeSlug}`
    : null;

  const handleTogglePubliek = async () => {
    setIsLoading(true);
    setError(null);
    setProgress('');

    if (isPubliek) {
      // Maak privé
      setProgress('Handboek privé maken...');

      if (publiekeSlug) {
        try {
          // Delete all files for this slug
          const { data: files } = await supabase.storage
            .from('publiek-handboeken')
            .list(publiekeSlug);

          if (files && files.length > 0) {
            const filesToDelete = files.map((f) => `${publiekeSlug}/${f.name}`);
            await supabase.storage.from('publiek-handboeken').remove(filesToDelete);
          }

          await supabase.storage.from('publiek-handboeken').remove([`${publiekeSlug}.html`]);
        } catch (err) {
          console.warn('Error deleting storage files:', err);
        }
      }

      const { error: updateError } = await supabase
        .from('handboeken')
        .update({ is_publiek: false, publieke_slug: null })
        .eq('id', handboekId);

      if (updateError) {
        setError(`Kon handboek niet privé maken: ${updateError.message}`);
      } else {
        onUpdate(false, null);
      }
    } else {
      // Maak publiek
      const newSlug = generateSlug();

      try {
        // Stap 1: Verzamel alle afbeeldingen (base64 én externe URLs)
        setProgress('Afbeeldingen voorbereiden...');

        const allImages: { url: string; id: string; index: number; isBase64: boolean }[] = [];

        // Cover afbeelding
        if (handboek.cover_url) {
          allImages.push({
            url: handboek.cover_url,
            id: 'cover',
            index: 0,
            isBase64: handboek.cover_url.startsWith('data:')
          });
        }

        // Hoofdstuk afbeeldingen (inclusief externe URLs zoals Pexels)
        let imgIndex = 1;
        Object.values(afbeeldingenPerHoofdstuk).forEach((afbeeldingen) => {
          afbeeldingen.forEach((afb) => {
            if (afb.url) {
              allImages.push({
                url: afb.url,
                id: afb.id,
                index: imgIndex++,
                isBase64: afb.url.startsWith('data:')
              });
            }
          });
        });

        // Stap 2: Comprimeer en upload afbeeldingen parallel
        const imageUrlMap: Record<string, string> = {};
        let uploadedCount = 0;
        let failedCount = 0;

        if (allImages.length > 0) {
          setProgress(`Afbeeldingen uploaden (0/${allImages.length})...`);

          // Process in batches of 3 for controlled parallelism
          const batchSize = 3;
          for (let i = 0; i < allImages.length; i += batchSize) {
            const batch = allImages.slice(i, i + batchSize);

            const results = await Promise.all(
              batch.map(async (imgData): Promise<UploadResult> => {
                try {
                  let converted: { blob: Blob; mimeType: string } | null = null;

                  if (imgData.isBase64) {
                    // Base64 image: compress and convert
                    const compressed = await compressImage(imgData.url);
                    converted = base64ToBlob(compressed);
                  } else {
                    // External URL (Pexels, etc.): fetch and convert to blob
                    converted = await fetchExternalImage(imgData.url);
                  }

                  if (!converted) {
                    return { originalUrl: imgData.url, publicUrl: null, error: 'Conversie mislukt' };
                  }

                  const ext = converted.mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
                  const fileName = `${newSlug}/img-${imgData.index}.${ext}`;

                  const success = await uploadWithRetry(supabase, fileName, converted.blob, converted.mimeType);

                  if (success) {
                    const { data: urlData } = supabase.storage
                      .from('publiek-handboeken')
                      .getPublicUrl(fileName);
                    return { originalUrl: imgData.url, publicUrl: urlData.publicUrl };
                  }

                  return { originalUrl: imgData.url, publicUrl: null, error: 'Upload mislukt' };
                } catch (err) {
                  console.error('Image processing error:', err);
                  return {
                    originalUrl: imgData.url,
                    publicUrl: null,
                    error: err instanceof Error ? err.message : 'Onbekende fout',
                  };
                }
              })
            );

            // Process results
            results.forEach((result) => {
              if (result.publicUrl) {
                imageUrlMap[result.originalUrl] = result.publicUrl;
                uploadedCount++;
              } else {
                failedCount++;
                console.warn('Failed to upload image:', result.error);
              }
            });

            setProgress(`Afbeeldingen uploaden (${uploadedCount + failedCount}/${allImages.length})...`);
          }

          if (failedCount > 0) {
            console.warn(`${failedCount} image(s) failed to upload`);
          }
        }

        // Stap 3: Genereer HTML met storage URLs
        setProgress('HTML genereren...');
        const publicHtml = generatePublicHTML(handboek, hoofdstukken, afbeeldingenPerHoofdstuk, imageUrlMap);

        // Stap 4: Upload HTML
        setProgress('Handboek publiceren...');
        const htmlFileName = `${newSlug}.html`;
        const htmlBlob = new Blob([publicHtml], { type: 'text/html' });

        const htmlSuccess = await uploadWithRetry(supabase, htmlFileName, htmlBlob, 'text/html', 3);

        if (!htmlSuccess) {
          throw new Error('Kon HTML niet uploaden na meerdere pogingen');
        }

        // Stap 5: Update database (alleen slug, geen HTML meer in DB)
        const { error: updateError } = await supabase
          .from('handboeken')
          .update({
            is_publiek: true,
            publieke_slug: newSlug,
          })
          .eq('id', handboekId);

        if (updateError) {
          if (updateError.code === '23505') {
            setError('Er is een conflict opgetreden. Probeer het opnieuw.');
          } else {
            setError(`Database update mislukt: ${updateError.message}`);
          }
        } else {
          onUpdate(true, newSlug);
          setProgress('');
        }
      } catch (err) {
        console.error('Error sharing:', err);
        setError(err instanceof Error ? err.message : 'Er ging iets mis bij het delen');
      }
    }

    setIsLoading(false);
    setProgress('');
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
        {isPubliek && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Handboek delen</h2>
              <button
                onClick={() => !isLoading && setIsOpen(false)}
                disabled={isLoading}
                className="text-secondary hover:text-foreground disabled:opacity-50"
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
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      isPubliek ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Progress indicator */}
              {isLoading && progress && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm text-blue-700">{progress}</span>
                </div>
              )}

              {/* Link kopiëren */}
              {isPubliek && publicUrl && !isLoading && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Deelbare link</label>
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
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
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
              {isPubliek && publicUrl && !isLoading && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-accent border border-border rounded-lg text-sm text-foreground hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
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
