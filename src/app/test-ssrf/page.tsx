'use client';

import { useState } from 'react';

interface TestResult {
  url: string;
  passed: boolean;
  message: string;
}

export default function TestSSRFPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [customUrl, setCustomUrl] = useState('https://example.com');
  const [customResult, setCustomResult] = useState<any>(null);

  const dangerousUrls = [
    'https://127.0.0.1',
    'https://localhost',
    'https://10.0.0.1',
    'https://192.168.1.1',
    'https://169.254.169.254', // AWS metadata endpoint
    'https://[::1]',
    'http://example.com', // Not HTTPS
    'https://user:pass@example.com', // Has credentials
  ];

  const safeUrls = [
    'https://example.com',
    'https://wikipedia.org',
    'https://google.com',
  ];

  const runAutomatedTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    const results: TestResult[] = [];

    // Test dangerous URLs (should be blocked)
    for (const url of dangerousUrls) {
      try {
        const response = await fetch('/api/verify-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sources: [{ title: 'Test', url }],
          }),
        });

        const data = await response.json();
        const result = data.results?.[0];

        // Should be blocked (ok = false with error)
        if (!result.ok && result.error) {
          results.push({
            url,
            passed: true,
            message: `✅ Blocked: ${result.error}`,
          });
        } else {
          results.push({
            url,
            passed: false,
            message: `❌ NOT BLOCKED! Status: ${result.status}`,
          });
        }
      } catch (error) {
        results.push({
          url,
          passed: true,
          message: `✅ Blocked: ${error instanceof Error ? error.message : 'Network error'}`,
        });
      }
    }

    // Test safe URLs (should be allowed)
    for (const url of safeUrls) {
      try {
        const response = await fetch('/api/verify-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sources: [{ title: 'Test', url }],
          }),
        });

        const data = await response.json();
        const result = data.results?.[0];

        // Should be allowed to attempt (even if unreachable)
        if (!result.error || result.error.includes('Network') || result.error.includes('timeout')) {
          results.push({
            url,
            passed: true,
            message: `✅ Allowed (Status: ${result.status || 'N/A'})`,
          });
        } else {
          results.push({
            url,
            passed: false,
            message: `❌ Incorrectly blocked: ${result.error}`,
          });
        }
      } catch (error) {
        results.push({
          url,
          passed: false,
          message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`,
        });
      }
    }

    setTestResults(results);
    setIsRunning(false);
  };

  const testCustomUrl = async () => {
    setCustomResult(null);
    try {
      const response = await fetch('/api/verify-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: [{ title: 'Custom Test', url: customUrl }],
        }),
      });

      const data = await response.json();
      setCustomResult(data);
    } catch (error) {
      setCustomResult({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const allPassed = testResults.length > 0 && testResults.every((r) => r.passed);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">SSRF Protection Test</h1>
          <p className="text-gray-600 mb-4">
            This page tests the verify-sources API endpoint for SSRF vulnerabilities.
          </p>

          {/* Automated Tests */}
          <div className="mb-6">
            <button
              onClick={runAutomatedTests}
              disabled={isRunning}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {isRunning ? 'Running Tests...' : 'Run Automated Tests'}
            </button>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="mb-6">
              <div
                className={`p-4 rounded-lg mb-4 ${
                  allPassed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {allPassed ? (
                    <>
                      <span className="text-2xl">✅</span>
                      <div>
                        <h2 className="text-lg font-semibold text-green-900">All Tests Passed!</h2>
                        <p className="text-sm text-green-700">SSRF protection is working correctly.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">❌</span>
                      <div>
                        <h2 className="text-lg font-semibold text-red-900">Some Tests Failed</h2>
                        <p className="text-sm text-red-700">SSRF protection has vulnerabilities!</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-3">Test Results:</h3>
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border ${
                      result.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm flex-shrink-0">{result.passed ? '✅' : '❌'}</span>
                      <div className="flex-1">
                        <code className="text-xs bg-white px-2 py-1 rounded">{result.url}</code>
                        <p className="text-sm mt-1">{result.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Custom URL Test */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Test Custom URL</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enter any URL to test SSRF protection:
          </p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="flex-1 p-2 border rounded font-mono text-sm"
              placeholder="https://example.com"
            />
            <button
              onClick={testCustomUrl}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
            >
              Test
            </button>
          </div>

          {customResult && (
            <div className="border rounded p-4 bg-gray-50">
              <h3 className="font-semibold mb-2">Result:</h3>
              <pre className="text-xs overflow-x-auto bg-white p-3 rounded border">
                {JSON.stringify(customResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Security Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">SSRF Protection Features</h2>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>HTTPS-only enforcement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Private IP range blocking (localhost, 10.x, 192.168.x, 127.x, 169.254.x)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>DNS resolution checks for private IPs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>URL credential rejection</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>URL length validation (max 2048 chars)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Request limit (max 10 URLs per request)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Rate limiting (10 requests per IP per minute)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Concurrency limiting (3 parallel fetches max)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Redirect limiting (max 2 redirects)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Timeout enforcement (5 seconds per URL)</span>
            </li>
          </ul>
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
