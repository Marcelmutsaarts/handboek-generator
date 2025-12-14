'use client';

import { useState, useRef } from 'react';
import { getApiKeyHeader } from '@/hooks/useApiKey';
import { consumeSSEFromReader } from '@/lib/sseClient';
import { Afbeelding } from '@/types';

interface ChapterEditorProps {
  content: string;
  onSave: (newContent: string, updatedImages?: Afbeelding[]) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  images?: Afbeelding[];
  onderwerp?: string;
  niveau?: string;
}

// Voorgedefinieerde AI instructies
const AI_INSTRUCTIES = [
  { label: 'Eenvoudiger maken', value: 'Herschrijf de tekst in eenvoudigere bewoordingen, geschikt voor leerlingen die moeite hebben met de stof.' },
  { label: 'Uitdagender maken', value: 'Maak de tekst uitdagender met complexere concepten en diepgaandere uitleg.' },
  { label: 'Meer voorbeelden', value: 'Voeg meer concrete voorbeelden toe die de concepten verduidelijken.' },
  { label: 'Korter maken', value: 'Maak de tekst korter en bondiger, behoud alleen de essentiële informatie.' },
  { label: 'Uitgebreider maken', value: 'Breid de tekst uit met meer details, uitleg en achtergrond.' },
];

export default function ChapterEditor({
  content,
  onSave,
  onCancel,
  isSaving,
  images = [],
  onderwerp = '',
  niveau = '',
}: ChapterEditorProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [editedImages, setEditedImages] = useState<Afbeelding[]>(images);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [customInstruction, setCustomInstruction] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewritePreview, setRewritePreview] = useState('');
  const [regeneratingImageId, setRegeneratingImageId] = useState<string | null>(null);
  const [deletedImageIds, setDeletedImageIds] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track selection in textarea
  const handleSelect = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      if (start !== end) {
        const selected = editedContent.substring(start, end);
        setSelectedText(selected);
        setSelectionRange({ start, end });
      }
    }
  };

  // Handle AI rewrite
  const handleAiRewrite = async (instructie: string) => {
    if (!selectedText && !editedContent) return;

    const textToRewrite = selectedText || editedContent;
    setIsRewriting(true);
    setRewritePreview('');

    try {
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeader(),
        },
        body: JSON.stringify({
          sectie: textToRewrite,
          instructie,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Rewrite failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let fullContent = '';

      await consumeSSEFromReader(reader, (data) => {
        if (data.type === 'content') {
          fullContent += data.content || '';
          setRewritePreview(fullContent);
        }
      });
    } catch (error) {
      console.error('Rewrite error:', error);
      alert('Er ging iets mis bij het herschrijven.');
    } finally {
      setIsRewriting(false);
    }
  };

  // Apply the AI rewrite to the content
  const applyRewrite = () => {
    if (!rewritePreview) return;

    if (selectionRange) {
      // Replace only the selected portion
      const newContent =
        editedContent.substring(0, selectionRange.start) +
        rewritePreview +
        editedContent.substring(selectionRange.end);
      setEditedContent(newContent);
    } else {
      // Replace entire content
      setEditedContent(rewritePreview);
    }

    // Reset state
    setRewritePreview('');
    setSelectedText('');
    setSelectionRange(null);
    setShowAiPanel(false);
    setCustomInstruction('');
  };

  const cancelRewrite = () => {
    setRewritePreview('');
    setSelectedText('');
    setSelectionRange(null);
    setCustomInstruction('');
  };

  // Image editing functions
  const handleCaptionChange = (imageId: string, newCaption: string) => {
    setEditedImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, caption: newCaption } : img
    ));
  };

  const handleAltChange = (imageId: string, newAlt: string) => {
    setEditedImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, alt: newAlt } : img
    ));
  };

  const handleDeleteImage = (imageId: string) => {
    setDeletedImageIds(prev => new Set([...prev, imageId]));
    setEditedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleRegenerateImage = async (image: Afbeelding) => {
    if (!onderwerp) {
      alert('Onderwerp ontbreekt - kan afbeelding niet regenereren');
      return;
    }

    setRegeneratingImageId(image.id);

    try {
      const response = await fetch('/api/fix-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeader(),
        },
        body: JSON.stringify({
          action: 'regenerate-standard',
          imageUrl: image.url,
          currentCaption: image.caption,
          currentAlt: image.alt,
          onderwerp,
          feedback: 'Regenereer deze afbeelding met een betere visuele weergave',
          niveau,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Regeneratie mislukt');
      }

      const result = await response.json();

      if (result.newImageUrl) {
        setEditedImages(prev => prev.map(img =>
          img.id === image.id
            ? {
                ...img,
                url: result.newImageUrl,
                caption: result.newCaption || img.caption,
                alt: result.newAlt || img.alt,
              }
            : img
        ));
      }
    } catch (error) {
      console.error('Regenerate error:', error);
      alert(error instanceof Error ? error.message : 'Kon afbeelding niet regenereren');
    } finally {
      setRegeneratingImageId(null);
    }
  };

  // Check for changes in content or images
  const imagesChanged =
    deletedImageIds.size > 0 ||
    editedImages.some((img, i) => {
      const original = images[i];
      if (!original) return true;
      return img.caption !== original.caption || img.alt !== original.alt || img.url !== original.url;
    });

  const hasChanges = editedContent !== content || imagesChanged;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-accent rounded-lg border border-border">
        <span className="text-sm font-medium text-foreground">Bewerkmodus</span>
        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setShowAiPanel(!showAiPanel)}
          disabled={isRewriting}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
            showAiPanel
              ? 'bg-primary text-white'
              : 'bg-white border border-border hover:border-primary'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Herschrijven
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm bg-white border border-border rounded-lg hover:bg-accent transition-colors"
        >
          Annuleren
        </button>

        <button
          type="button"
          onClick={() => onSave(editedContent, editedImages)}
          disabled={isSaving || !hasChanges}
          className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Opslaan...
            </>
          ) : (
            'Opslaan'
          )}
        </button>
      </div>

      {/* AI Panel */}
      {showAiPanel && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-blue-900 mb-2">
              {selectedText ? (
                <>Geselecteerde tekst herschrijven ({selectedText.length} tekens)</>
              ) : (
                <>Selecteer tekst om te herschrijven, of herschrijf het hele hoofdstuk</>
              )}
            </p>

            {selectedText && (
              <div className="bg-white rounded p-2 text-xs text-blue-800 max-h-20 overflow-y-auto border border-blue-200 mb-3">
                {selectedText.substring(0, 200)}{selectedText.length > 200 ? '...' : ''}
              </div>
            )}
          </div>

          {/* Preset instructions */}
          <div>
            <p className="text-xs text-blue-700 mb-2">Snelle opties:</p>
            <div className="flex flex-wrap gap-2">
              {AI_INSTRUCTIES.map((instr) => (
                <button
                  key={instr.label}
                  type="button"
                  onClick={() => handleAiRewrite(instr.value)}
                  disabled={isRewriting}
                  className="px-3 py-1.5 text-xs bg-white border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  {instr.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom instruction */}
          <div>
            <p className="text-xs text-blue-700 mb-2">Of geef je eigen instructie:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="Bijv: Voeg een voorbeeld toe over voetbal"
                disabled={isRewriting}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customInstruction.trim()) {
                    handleAiRewrite(customInstruction);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleAiRewrite(customInstruction)}
                disabled={isRewriting || !customInstruction.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Herschrijf
              </button>
            </div>
          </div>

          {/* Rewrite preview */}
          {(isRewriting || rewritePreview) && (
            <div className="border-t border-blue-200 pt-4">
              <p className="text-xs font-medium text-blue-900 mb-2">
                {isRewriting ? 'Bezig met herschrijven...' : 'Herschreven tekst:'}
              </p>
              <div className="bg-white rounded-lg p-3 text-sm max-h-60 overflow-y-auto border border-blue-200">
                {rewritePreview || <span className="text-blue-400 animate-pulse">Tekst wordt gegenereerd...</span>}
              </div>

              {rewritePreview && !isRewriting && (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={applyRewrite}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Toepassen
                  </button>
                  <button
                    type="button"
                    onClick={cancelRewrite}
                    className="px-4 py-2 text-sm bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Annuleren
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          onSelect={handleSelect}
          disabled={isSaving}
          className="w-full min-h-[500px] p-4 font-mono text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          placeholder="Markdown content..."
        />

        {/* Character count */}
        <div className="absolute bottom-3 right-3 text-xs text-secondary bg-white px-2 py-1 rounded">
          {editedContent.length} tekens
        </div>
      </div>

      {/* Help text */}
      <p className="text-xs text-secondary">
        Tip: Selecteer een deel van de tekst en gebruik &quot;AI Herschrijven&quot; om alleen dat deel aan te passen.
        De markdown opmaak (# headers, **vet**, - lijsten) blijft behouden.
      </p>

      {/* Image editing section */}
      {editedImages.length > 0 && (
        <div className="mt-8 border-t border-border pt-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Afbeeldingen ({editedImages.length})
          </h3>

          <div className="space-y-6">
            {editedImages.map((image, index) => (
              <div key={image.id} className="bg-accent rounded-lg p-4 border border-border">
                <div className="flex gap-4">
                  {/* Image preview */}
                  <div className="flex-shrink-0 w-40 h-28 relative rounded-lg overflow-hidden bg-gray-100">
                    {regeneratingImageId === image.id ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                        <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
                      </div>
                    ) : null}
                    <img
                      src={image.url}
                      alt={image.alt || `Afbeelding ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Edit fields */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-1">
                        Onderschrift (caption)
                      </label>
                      <input
                        type="text"
                        value={image.caption || ''}
                        onChange={(e) => handleCaptionChange(image.id, e.target.value)}
                        disabled={isSaving || regeneratingImageId === image.id}
                        placeholder="Afb: Beschrijving van de afbeelding"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-secondary mb-1">
                        Alt-tekst (voor toegankelijkheid)
                      </label>
                      <input
                        type="text"
                        value={image.alt || ''}
                        onChange={(e) => handleAltChange(image.id, e.target.value)}
                        disabled={isSaving || regeneratingImageId === image.id}
                        placeholder="Beschrijving voor screenreaders"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2">
                    {image.is_ai_generated && (
                      <button
                        type="button"
                        onClick={() => handleRegenerateImage(image)}
                        disabled={isSaving || regeneratingImageId !== null}
                        className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        title="Genereer nieuwe afbeelding met AI"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenereer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(image.id)}
                      disabled={isSaving || regeneratingImageId === image.id}
                      className="px-3 py-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      title="Verwijder afbeelding"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Verwijder
                    </button>
                  </div>
                </div>

                {/* Image metadata */}
                <div className="mt-3 flex items-center gap-4 text-xs text-secondary">
                  <span>Afbeelding {index + 1}</span>
                  {image.is_ai_generated ? (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">AI-gegenereerd</span>
                  ) : image.photographer ? (
                    <span>
                      Foto: {image.photographer_url ? (
                        <a href={image.photographer_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {image.photographer}
                        </a>
                      ) : image.photographer}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {deletedImageIds.size > 0 && (
            <p className="mt-4 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              {deletedImageIds.size} afbeelding(en) gemarkeerd voor verwijdering. Klik op &quot;Opslaan&quot; om de wijzigingen door te voeren.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
