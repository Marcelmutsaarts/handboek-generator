'use client';

import { useState } from 'react';

export interface Source {
  title: string;
  url: string;
}

interface SourceVerificationModalProps {
  isOpen: boolean;
  sources: Source[];
  onClose: () => void;
  onRemoveSources: (sourcesToRemove: Source[]) => void;
}

function SourceItem({
  source,
  isSelected,
  onToggle,
}: {
  source: Source;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`bg-white rounded-lg p-4 border ${isSelected ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900">{source.title}</h4>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline break-all"
          >
            {source.url}
          </a>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-sm"
        >
          Bekijk
        </a>
      </div>
    </div>
  );
}

export default function SourceVerificationModal({
  isOpen,
  sources,
  onClose,
  onRemoveSources,
}: SourceVerificationModalProps) {
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const toggleSource = (url: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const handleRemoveSelected = () => {
    const toRemove = sources.filter((s) => selectedSources.has(s.url));
    onRemoveSources(toRemove);
    setSelectedSources(new Set());
  };

  const selectAll = () => {
    setSelectedSources(new Set(sources.map((s) => s.url)));
  };

  const selectNone = () => {
    setSelectedSources(new Set());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Bronnen controleren</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {sources.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Geen bronnen gevonden in het hoofdstuk</p>
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  Klik op "Bekijk" om een bron te controleren. Selecteer bronnen die je wilt verwijderen en klik op "Verwijder geselecteerde".
                </p>
              </div>

              {/* Quick select */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-600">
                  {sources.length} bron{sources.length !== 1 ? 'nen' : ''} gevonden
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs text-gray-600 hover:text-gray-900 underline"
                  >
                    Alles selecteren
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={selectNone}
                    className="text-xs text-gray-600 hover:text-gray-900 underline"
                  >
                    Niets selecteren
                  </button>
                </div>
              </div>

              {/* Source list */}
              <div className="space-y-3 mb-6">
                {sources.map((source) => (
                  <SourceItem
                    key={source.url}
                    source={source}
                    isSelected={selectedSources.has(source.url)}
                    onToggle={() => toggleSource(source.url)}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="border-t border-gray-200 pt-4 flex gap-3">
                {selectedSources.size > 0 && (
                  <button
                    onClick={handleRemoveSelected}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 border-2 border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="font-medium">Verwijder geselecteerde ({selectedSources.size})</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`${selectedSources.size > 0 ? '' : 'flex-1'} flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 border-2 border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors`}
                >
                  <span className="font-medium">Sluiten</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
