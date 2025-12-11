'use client';

import { useState, useEffect } from 'react';
import { renderSafeMarkdown, testXSSProtection } from '@/lib/safeMarkdown';

export default function TestXSSPage() {
  const [testResults, setTestResults] = useState<{
    passed: boolean;
    results: { test: string; safe: boolean; output: string }[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customInput, setCustomInput] = useState('<script>alert("XSS")</script>Hello World');
  const [customOutput, setCustomOutput] = useState('');

  useEffect(() => {
    // Run XSS protection tests on mount
    testXSSProtection().then((results) => {
      setTestResults(results);
      setIsLoading(false);
    });
  }, []);

  const handleTestCustom = async () => {
    const output = await renderSafeMarkdown(customInput);
    setCustomOutput(output);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Running XSS protection tests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">XSS Protection Test Results</h1>
          <p className="text-gray-600 mb-4">
            This page verifies that all dangerous content is properly sanitized.
          </p>

          {/* Overall status */}
          <div
            className={`p-4 rounded-lg mb-6 ${
              testResults?.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResults?.passed ? (
                <>
                  <span className="text-2xl">✅</span>
                  <div>
                    <h2 className="text-lg font-semibold text-green-900">All Tests Passed!</h2>
                    <p className="text-sm text-green-700">XSS protection is working correctly.</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-2xl">❌</span>
                  <div>
                    <h2 className="text-lg font-semibold text-red-900">Some Tests Failed</h2>
                    <p className="text-sm text-red-700">Please review the results below.</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Individual test results */}
          <h3 className="text-lg font-semibold mb-3">Test Cases:</h3>
          <div className="space-y-3">
            {testResults?.results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded border ${
                  result.safe ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span>{result.safe ? '✅' : '❌'}</span>
                  <div className="flex-1">
                    <h4 className="font-medium">{result.test}</h4>
                    <details className="mt-2">
                      <summary className="text-sm text-gray-600 cursor-pointer">
                        View output
                      </summary>
                      <pre className="mt-2 p-2 bg-white rounded border text-xs overflow-x-auto">
                        {result.output}
                      </pre>
                    </details>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom test input */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Test Custom Input</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enter any content below to see how it's sanitized:
          </p>

          <textarea
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="w-full p-3 border rounded-lg mb-3 font-mono text-sm"
            rows={6}
            placeholder="Enter markdown or HTML to test..."
          />

          <button
            onClick={handleTestCustom}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            Test Input
          </button>

          {customOutput && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Sanitized Output:</h3>
              <div className="border rounded-lg p-4 bg-gray-50 mb-3">
                <div dangerouslySetInnerHTML={{ __html: customOutput }} className="prose max-w-none" />
              </div>

              <details>
                <summary className="text-sm text-gray-600 cursor-pointer mb-2">
                  View raw HTML
                </summary>
                <pre className="p-3 bg-white border rounded text-xs overflow-x-auto">
                  {customOutput}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Safe features demonstration */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">Safe Features Demo</h2>
          <p className="text-sm text-gray-600 mb-4">
            These markdown features work correctly and safely:
          </p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Headings (H1, H2, H3)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Bold & Italic text</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Lists (bullet & numbered)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Links (http/https only)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Images (http/https/data)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Code blocks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Blockquotes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>LaTeX formulas (KaTeX)</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <h4 className="font-semibold text-red-900 mb-2">Blocked (for security):</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-red-600">✗</span>
                <code className="text-xs">&lt;script&gt;</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-600">✗</span>
                <code className="text-xs">onclick/onerror</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-600">✗</span>
                <code className="text-xs">&lt;iframe&gt;</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-600">✗</span>
                <code className="text-xs">javascript:</code>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-primary hover:underline"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
