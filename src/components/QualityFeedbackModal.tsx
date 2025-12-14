'use client';

import { useState } from 'react';

interface QualityScore {
  score: number;
  feedback: string[];
}

interface QualityReport {
  bias: QualityScore;
  helderheid: QualityScore;
  didactiek: QualityScore;
  niveauGeschikt: QualityScore;
  afbeeldingen?: QualityScore; // Optional for backwards compatibility
  totaal: number;
  aanbeveling: 'excellent' | 'goed' | 'verbeteren';
  samenvatting: string;
}

interface SelectedFeedback {
  criterium: string;
  feedbackItem: string;
}

interface QualityFeedbackModalProps {
  report: QualityReport;
  isLoading: boolean;
  isImproving: boolean;
  onImprove: (selectedFeedback: SelectedFeedback[]) => Promise<void>;
  onClose: () => void;
}

const CRITERIA_LABELS: Record<string, { naam: string; icon: string; beschrijving: string }> = {
  bias: {
    naam: 'Bias & Inclusiviteit',
    icon: '⚖️',
    beschrijving: 'Genderneutraliteit, culturele aannames, diversiteit in voorbeelden',
  },
  helderheid: {
    naam: 'Helderheid & Begrijpelijkheid',
    icon: '💡',
    beschrijving: 'Taalgebruik, zinslengte, uitleg van moeilijke woorden',
  },
  didactiek: {
    naam: 'Didactische Kwaliteit',
    icon: '📚',
    beschrijving: 'Structuur, voorbeelden, opbouw van eenvoudig naar complex',
  },
  niveauGeschikt: {
    naam: 'Niveau-geschiktheid',
    icon: '🎯',
    beschrijving: 'Taal, diepgang en voorbeelden passend bij het niveau',
  },
  afbeeldingen: {
    naam: 'Afbeeldingen & Onderschriften',
    icon: '🖼️',
    beschrijving: 'Relevantie afbeeldingen, correctheid captions, spelfouten',
  },
};

// Define which criteria to show (afbeeldingen only if present in report)
const getActiveCriteria = (report: QualityReport): string[] => {
  const baseCriteria = ['bias', 'helderheid', 'didactiek', 'niveauGeschikt'];
  if (report.afbeeldingen) {
    return [...baseCriteria, 'afbeeldingen'];
  }
  return baseCriteria;
};

export default function QualityFeedbackModal({
  report,
  isLoading,
  isImproving,
  onImprove,
  onClose,
}: QualityFeedbackModalProps) {
  const activeCriteria = getActiveCriteria(report);

  // Track which feedback items are selected (all selected by default)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(() => {
    const allItems = new Set<string>();
    activeCriteria.forEach((criterium) => {
      const score = report[criterium as keyof QualityReport] as QualityScore;
      if (score && score.feedback) {
        score.feedback.forEach((_, index) => {
          allItems.add(`${criterium}-${index}`);
        });
      }
    });
    return allItems;
  });

  const toggleItem = (criterium: string, index: number) => {
    const key = `${criterium}-${index}`;
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedItems(newSelected);
  };

  const toggleCriterium = (criterium: string) => {
    const score = report[criterium as keyof QualityReport] as QualityScore;
    if (!score || !score.feedback) return;

    const criteriumItems = score.feedback.map((_, i) => `${criterium}-${i}`);
    const allSelected = criteriumItems.every((key) => selectedItems.has(key));

    const newSelected = new Set(selectedItems);
    if (allSelected) {
      // Deselect all
      criteriumItems.forEach((key) => newSelected.delete(key));
    } else {
      // Select all
      criteriumItems.forEach((key) => newSelected.add(key));
    }
    setSelectedItems(newSelected);
  };

  const handleApply = async () => {
    const selectedFeedback: SelectedFeedback[] = [];

    activeCriteria.forEach((criterium) => {
      const score = report[criterium as keyof QualityReport] as QualityScore;
      if (score && score.feedback) {
        score.feedback.forEach((item, index) => {
          if (selectedItems.has(`${criterium}-${index}`)) {
            selectedFeedback.push({
              criterium: CRITERIA_LABELS[criterium].naam,
              feedbackItem: item,
            });
          }
        });
      }
    });

    await onImprove(selectedFeedback);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 4.5) return 'text-green-700 bg-green-100';
    if (score >= 3.5) return 'text-yellow-700 bg-yellow-100';
    return 'text-red-700 bg-red-100';
  };

  const getRecommendationColor = (rec: string): string => {
    if (rec === 'excellent') return 'bg-green-100 text-green-800 border-green-200';
    if (rec === 'goed') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getRecommendationLabel = (rec: string): string => {
    if (rec === 'excellent') return '✨ Uitstekend';
    if (rec === 'goed') return '👍 Goed';
    return '⚠️ Verbetering mogelijk';
  };

  const selectedCount = selectedItems.size;
  const totalCount = activeCriteria.reduce((total, criterium) => {
    const score = report[criterium as keyof QualityReport] as QualityScore;
    return total + (score?.feedback?.length || 0);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Kwaliteitsanalyse</h2>
              <p className="text-sm text-gray-600">{report.samenvatting}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isImproving}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Overall score */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Totaalscore:</span>
              <span className={`px-3 py-1 rounded-full text-lg font-bold ${getScoreColor(report.totaal)}`}>
                {report.totaal.toFixed(1)} / 5.0
              </span>
            </div>
            <div className={`px-4 py-2 rounded-lg border-2 ${getRecommendationColor(report.aanbeveling)}`}>
              <span className="font-semibold">{getRecommendationLabel(report.aanbeveling)}</span>
            </div>
          </div>
        </div>

        {/* Feedback per criterium */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              {activeCriteria.map((criterium) => {
                const score = report[criterium as keyof QualityReport] as QualityScore;
                if (!score) return null;

                const info = CRITERIA_LABELS[criterium];
                const criteriumItems = score.feedback.map((_, i) => `${criterium}-${i}`);
                const allSelected = criteriumItems.every((key) => selectedItems.has(key));
                const someSelected = criteriumItems.some((key) => selectedItems.has(key));

                return (
                  <div key={criterium} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Criterium header */}
                    <div className="bg-gray-50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{info.icon}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900">{info.naam}</h3>
                            <p className="text-xs text-gray-600">{info.beschrijving}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(score.score)}`}>
                            {score.score} / 5
                          </span>
                          <button
                            onClick={() => toggleCriterium(criterium)}
                            className="text-xs px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                          >
                            {allSelected ? 'Deselecteer alles' : 'Selecteer alles'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Feedback items */}
                    {score.feedback && score.feedback.length > 0 && (
                      <div className="p-4 space-y-2">
                        {score.feedback.map((item, index) => {
                          const key = `${criterium}-${index}`;
                          const isSelected = selectedItems.has(key);

                          return (
                            <label
                              key={index}
                              className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-primary bg-blue-50'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItem(criterium, index)}
                                className="mt-0.5 w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                              />
                              <span className={`flex-1 text-sm ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                                {item}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedCount} van {totalCount} feedback punten geselecteerd
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={isImproving}
                className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Annuleren
              </button>
              <button
                onClick={handleApply}
                disabled={isImproving || selectedCount === 0}
                className="px-6 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isImproving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Tekst verbeteren...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Geselecteerde feedback toepassen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
