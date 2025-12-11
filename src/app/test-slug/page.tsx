'use client';

import { useState, useEffect } from 'react';
import { testSlugValidation } from '@/lib/slug';

interface TestResult {
  slug: string;
  shouldBlock: boolean;
  blocked: boolean;
  error?: string;
}

export default function TestSlugPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customSlug, setCustomSlug] = useState('geschiedenis-vmbo1');
  const [customResult, setCustomResult] = useState<{ valid: boolean; error?: string } | null>(null);

  useEffect(() => {
    // Run slug validation tests on mount
    const result = testSlugValidation();
    setTestResults(result.results);
    setIsLoading(false);
  }, []);

  const testCustomSlug = () => {
    // Import assertValidSlug dynamically to test
    import('@/lib/slug').then(({ assertValidSlug }) => {
      try {
        assertValidSlug(customSlug);
        setCustomResult({ valid: true });
      } catch (error) {
        setCustomResult({
          valid: false,
          error: error instanceof Error ? error.message : 'Validation failed',
        });
      }
    });
  };

  const normalizeCustomSlug = () => {
    import('@/lib/slug').then(({ normalizeSlug }) => {
      try {
        const normalized = normalizeSlug(customSlug);
        setCustomSlug(normalized);
        setCustomResult({ valid: true, error: `Normalized to: ${normalized}` });
      } catch (error) {
        setCustomResult({
          valid: false,
          error: error instanceof Error ? error.message : 'Normalization failed',
        });
      }
    });
  };

  const allPassed = testResults.length > 0 && testResults.every((r) => r.shouldBlock === r.blocked);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Running slug validation tests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">Slug Validation Test Results</h1>
          <p className="text-gray-600 mb-4">
            This page verifies that slug validation prevents path traversal and injection attacks.
          </p>

          {/* Overall status */}
          <div
            className={`p-4 rounded-lg mb-6 ${
              allPassed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {allPassed ? (
                <>
                  <span className="text-2xl">✅</span>
                  <div>
                    <h2 className="text-lg font-semibold text-green-900">All Tests Passed!</h2>
                    <p className="text-sm text-green-700">Slug validation is working correctly.</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-2xl">❌</span>
                  <div>
                    <h2 className="text-lg font-semibold text-red-900">Some Tests Failed</h2>
                    <p className="text-sm text-red-700">Slug validation has vulnerabilities!</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Test Results */}
          <h3 className="text-lg font-semibold mb-3">Test Cases:</h3>
          <div className="space-y-2">
            {testResults.map((result, index) => {
              const passed = result.shouldBlock === result.blocked;
              const expectedAction = result.shouldBlock ? 'BLOCK' : 'ALLOW';
              const actualAction = result.blocked ? 'BLOCKED' : 'ALLOWED';

              return (
                <div
                  key={index}
                  className={`p-3 rounded border ${
                    passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm flex-shrink-0">{passed ? '✅' : '❌'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs bg-white px-2 py-1 rounded font-mono">
                          {result.slug}
                        </code>
                        <span className="text-xs text-gray-600">
                          Expected: {expectedAction}, Got: {actualAction}
                        </span>
                      </div>
                      {result.error && (
                        <p className="text-xs text-gray-700 mt-1">Error: {result.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Slug Test */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Test Custom Slug</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enter a slug to test validation or normalization:
          </p>

          <div className="space-y-3">
            <input
              type="text"
              value={customSlug}
              onChange={(e) => {
                setCustomSlug(e.target.value);
                setCustomResult(null);
              }}
              className="w-full p-2 border rounded font-mono text-sm"
              placeholder="geschiedenis-vmbo1"
            />

            <div className="flex gap-2">
              <button
                onClick={testCustomSlug}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
              >
                Validate
              </button>
              <button
                onClick={normalizeCustomSlug}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Normalize
              </button>
            </div>

            {customResult && (
              <div
                className={`p-3 rounded border ${
                  customResult.valid
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{customResult.valid ? '✅' : '❌'}</span>
                  <div>
                    <p className="font-semibold text-sm">
                      {customResult.valid ? 'Valid Slug' : 'Invalid Slug'}
                    </p>
                    {customResult.error && (
                      <p className="text-sm text-gray-700 mt-1">{customResult.error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">Slug Validation Rules</h2>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Lowercase only (a-z)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Numbers allowed (0-9)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Hyphens allowed (-)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Maximum 60 characters</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Must start with letter or number</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Cannot end with hyphen</span>
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-blue-900 mt-4 mb-2">Blocked (Security)</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <code className="text-xs bg-white px-1 rounded">../</code> - Path traversal
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <code className="text-xs bg-white px-1 rounded">/</code> or{' '}
              <code className="text-xs bg-white px-1 rounded">\</code> - Directory separators
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <code className="text-xs bg-white px-1 rounded">%2f</code>,{' '}
              <code className="text-xs bg-white px-1 rounded">%5c</code> - Encoded separators
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <span>Whitespace, special characters, underscores</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <span>Consecutive hyphens (--)</span>
            </li>
          </ul>
        </div>

        {/* Examples */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Examples</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-green-700 mb-2">✅ Valid Slugs</h3>
              <div className="space-y-1">
                <code className="block text-sm bg-green-50 px-3 py-2 rounded">
                  geschiedenis-vmbo1
                </code>
                <code className="block text-sm bg-green-50 px-3 py-2 rounded">
                  wiskunde-havo-3
                </code>
                <code className="block text-sm bg-green-50 px-3 py-2 rounded">
                  natuur-en-techniek
                </code>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-red-700 mb-2">❌ Invalid Slugs</h3>
              <div className="space-y-1">
                <code className="block text-sm bg-red-50 px-3 py-2 rounded">
                  ../etc/passwd <span className="text-xs text-gray-600">(path traversal)</span>
                </code>
                <code className="block text-sm bg-red-50 px-3 py-2 rounded">
                  user/admin <span className="text-xs text-gray-600">(directory injection)</span>
                </code>
                <code className="block text-sm bg-red-50 px-3 py-2 rounded">
                  test%2ffile <span className="text-xs text-gray-600">(encoded slash)</span>
                </code>
                <code className="block text-sm bg-red-50 px-3 py-2 rounded">
                  hello world <span className="text-xs text-gray-600">(whitespace)</span>
                </code>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-primary hover:underline">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
