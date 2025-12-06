'use client';

import { useState, useRef, useEffect } from 'react';
import { getApiKeyHeader } from '@/hooks/useApiKey';

interface ChapterEditorProps {
  content: string;
  onSave: (newContent: string) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
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
}: ChapterEditorProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [customInstruction, setCustomInstruction] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewritePreview, setRewritePreview] = useState('');
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

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content') {
                fullContent += data.content;
                setRewritePreview(fullContent);
              }
            } catch {
              // Ignore
            }
          }
        }
      }
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

  const hasChanges = editedContent !== content;

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
          onClick={() => onSave(editedContent)}
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
    </div>
  );
}
