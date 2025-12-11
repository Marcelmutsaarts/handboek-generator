'use client';

import { useState } from 'react';

interface QualityScore {
  score: number;
  feedback: string[];
}

export interface QualityReport {
  bias: QualityScore;
  helderheid: QualityScore;
  didactiek: QualityScore;
  niveauGeschikt: QualityScore;
  totaal: number;
  aanbeveling: 'excellent' | 'goed' | 'verbeteren';
  samenvatting: string;
}

interface QualityCheckModalProps {
  isOpen: boolean;
  report: QualityReport | null;
  isLoading: boolean;
  isImproving: boolean;
  onClose: () => void;
  onAccept: () => void;
  onImprove: () => void;
  onEdit: () => void;
}

function ScoreBadge({ score }: { score: number }) {
  let bgColor = 'bg-red-100 text-red-700';
  let emoji = '🔴';

  if (score >= 4.5) {
    bgColor = 'bg-green-100 text-green-700';
    emoji = '🟢';
  } else if (score >= 3.5) {
    bgColor = 'bg-yellow-100 text-yellow-700';
    emoji = '🟡';
  }

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${bgColor}`}>
      <span>{emoji}</span>
      <span>{score}/5</span>
    </span>
  );
}

function CategoryScore({ title, qualityScore }: { title: string; qualityScore: QualityScore }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900">{title}</h4>
        <ScoreBadge score={qualityScore.score} />
      </div>
      {qualityScore.feedback.length > 0 && (
        <ul className="space-y-1">
          {qualityScore.feedback.map((item, idx) => (
            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function QualityCheckModal({
  isOpen,
  report,
  isLoading,
  isImproving,
  onClose,
  onAccept,
  onImprove,
  onEdit,
}: QualityCheckModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">🔍 Kwaliteitscontrole</h2>
          <button
            onClick={onClose}
            disabled={isLoading || isImproving}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-600">Hoofdstuk wordt gecontroleerd op kwaliteit...</p>
              <p className="text-sm text-gray-500 mt-2">Dit duurt ongeveer 10-15 seconden</p>
            </div>
          ) : isImproving ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-600">Hoofdstuk wordt verbeterd...</p>
              <p className="text-sm text-gray-500 mt-2">Dit duurt ongeveer 30-60 seconden</p>
            </div>
          ) : report ? (
            <>
              {/* Overall Score */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Totaalscore</h3>
                    <p className="text-sm text-gray-600 mt-1">{report.samenvatting}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-gray-900">{report.totaal}</div>
                    <div className="text-sm text-gray-600">van 5.0</div>
                  </div>
                </div>
                <div className="mt-4">
                  {report.aanbeveling === 'excellent' && (
                    <div className="flex items-center gap-2 text-green-700 bg-green-100 px-4 py-2 rounded-lg">
                      <span className="text-xl">✨</span>
                      <span className="font-medium">Uitstekende kwaliteit!</span>
                    </div>
                  )}
                  {report.aanbeveling === 'goed' && (
                    <div className="flex items-center gap-2 text-blue-700 bg-blue-100 px-4 py-2 rounded-lg">
                      <span className="text-xl">👍</span>
                      <span className="font-medium">Goede kwaliteit - kleine verbeteringen mogelijk</span>
                    </div>
                  )}
                  {report.aanbeveling === 'verbeteren' && (
                    <div className="flex items-center gap-2 text-orange-700 bg-orange-100 px-4 py-2 rounded-lg">
                      <span className="text-xl">⚠️</span>
                      <span className="font-medium">Verbetering aanbevolen</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Scores */}
              <div className="space-y-4 mb-6">
                <CategoryScore title="Bias & Inclusiviteit" qualityScore={report.bias} />
                <CategoryScore title="Helderheid & Begrijpelijkheid" qualityScore={report.helderheid} />
                <CategoryScore title="Didactische Kwaliteit" qualityScore={report.didactiek} />
                <CategoryScore title="Niveau-geschiktheid" qualityScore={report.niveauGeschikt} />
              </div>

              {/* Actions */}
              <div className="border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-600 mb-4">Wat wil je doen met dit hoofdstuk?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={onAccept}
                    className="flex flex-col items-center gap-2 px-4 py-3 bg-green-50 border-2 border-green-200 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Accepteren</span>
                    <span className="text-xs text-green-600">Hoofdstuk is goed</span>
                  </button>

                  <button
                    onClick={onImprove}
                    className="flex flex-col items-center gap-2 px-4 py-3 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span className="font-medium">Verbeteren</span>
                    <span className="text-xs text-blue-600">AI verbetert automatisch</span>
                  </button>

                  <button
                    onClick={onEdit}
                    className="flex flex-col items-center gap-2 px-4 py-3 bg-gray-50 border-2 border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    <span className="font-medium">Handmatig bewerken</span>
                    <span className="text-xs text-gray-600">Pas zelf aan</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Geen kwaliteitsrapport beschikbaar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
