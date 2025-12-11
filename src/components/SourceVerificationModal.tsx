'use client';

interface VerificationResult {
  url: string;
  title: string;
  status: 'verified' | 'unreachable' | 'invalid' | 'suspicious';
  message: string;
  isTrustedDomain: boolean;
}

interface VerificationStats {
  total: number;
  verified: number;
  unreachable: number;
  invalid: number;
  suspicious: number;
  trusted: number;
}

export interface SourceVerificationReport {
  results: VerificationResult[];
  stats: VerificationStats;
}

interface SourceVerificationModalProps {
  isOpen: boolean;
  report: SourceVerificationReport | null;
  isLoading: boolean;
  onClose: () => void;
  onAccept: () => void;
  onRetry: () => void;
  onRemoveBadSources?: () => void;
}

function StatusBadge({ status }: { status: VerificationResult['status'] }) {
  const config = {
    verified: { bg: 'bg-green-100 text-green-700', icon: '✓', label: 'Geverifieerd' },
    unreachable: { bg: 'bg-red-100 text-red-700', icon: '✗', label: 'Niet bereikbaar' },
    invalid: { bg: 'bg-red-100 text-red-700', icon: '✗', label: 'Ongeldig' },
    suspicious: { bg: 'bg-yellow-100 text-yellow-700', icon: '⚠', label: 'Verdacht' },
  };

  const { bg, icon, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg}`}>
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function SourceItem({ result }: { result: VerificationResult }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{result.title}</h4>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline break-all"
          >
            {result.url}
          </a>
        </div>
        <StatusBadge status={result.status} />
      </div>
      <div className="flex items-start gap-2">
        <p className="text-sm text-gray-600">{result.message}</p>
        {result.isTrustedDomain && (
          <span className="flex-shrink-0 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
            Betrouwbaar domein
          </span>
        )}
      </div>
    </div>
  );
}

export default function SourceVerificationModal({
  isOpen,
  report,
  isLoading,
  onClose,
  onAccept,
  onRetry,
  onRemoveBadSources,
}: SourceVerificationModalProps) {
  if (!isOpen) return null;

  const hasProblems = report && (report.stats.unreachable > 0 || report.stats.invalid > 0 || report.stats.suspicious > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">📚 Bronverificatie</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
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
              <p className="text-gray-600">Bronnen worden geverifieerd...</p>
              <p className="text-sm text-gray-500 mt-2">Dit duurt ongeveer 10-20 seconden</p>
            </div>
          ) : report ? (
            <>
              {/* Statistics */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Verificatieresultaten</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {report.stats.verified} van {report.stats.total} bronnen geverifieerd
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-gray-900">
                      {Math.round((report.stats.verified / report.stats.total) * 100)}%
                    </div>
                    <div className="text-sm text-gray-600">succesvol</div>
                  </div>
                </div>

                {/* Statistics breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Geverifieerd</span>
                      <span className="font-semibold text-green-700">{report.stats.verified}</span>
                    </div>
                  </div>
                  {report.stats.trusted > 0 && (
                    <div className="bg-white rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Betrouwbaar domein</span>
                        <span className="font-semibold text-blue-700">{report.stats.trusted}</span>
                      </div>
                    </div>
                  )}
                  {report.stats.unreachable > 0 && (
                    <div className="bg-white rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Niet bereikbaar</span>
                        <span className="font-semibold text-red-700">{report.stats.unreachable}</span>
                      </div>
                    </div>
                  )}
                  {report.stats.invalid > 0 && (
                    <div className="bg-white rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Ongeldig</span>
                        <span className="font-semibold text-red-700">{report.stats.invalid}</span>
                      </div>
                    </div>
                  )}
                  {report.stats.suspicious > 0 && (
                    <div className="bg-white rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Verdacht</span>
                        <span className="font-semibold text-yellow-700">{report.stats.suspicious}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Warning if there are problems */}
                {hasProblems && (
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-600 text-xl flex-shrink-0">⚠️</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">Let op</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Sommige bronnen konden niet worden geverifieerd. Dit kunnen fictieve bronnen zijn of tijdelijk onbereikbare websites.
                          Controleer de bronnen handmatig voordat je het hoofdstuk opslaat.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Source list */}
              <div className="space-y-3 mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Alle bronnen ({report.results.length})</h4>
                {report.results.map((result, index) => (
                  <SourceItem key={index} result={result} />
                ))}
              </div>

              {/* Actions */}
              <div className="border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-600 mb-4">Wat wil je doen?</p>

                {/* Remove bad sources button (only if there are problems) */}
                {hasProblems && onRemoveBadSources && (
                  <button
                    onClick={onRemoveBadSources}
                    className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 border-2 border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="font-medium">Verwijder slechte bronnen</span>
                    <span className="text-xs text-red-600 ml-2">({report.stats.unreachable + report.stats.invalid} bronnen)</span>
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={onAccept}
                    className="flex flex-col items-center gap-2 px-4 py-3 bg-green-50 border-2 border-green-200 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Accepteren</span>
                    <span className="text-xs text-green-600">Bronnen zijn goed genoeg</span>
                  </button>

                  <button
                    onClick={onRetry}
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
                    <span className="font-medium">Opnieuw genereren</span>
                    <span className="text-xs text-blue-600">Vraag betere bronnen aan AI</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Geen verificatierapport beschikbaar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
