import { NextRequest, NextResponse } from 'next/server';
import { assertUrlIsSafe, safeFetch } from '@/lib/urlSafety';
import { RateLimiter, getClientIp } from '@/lib/rateLimiter';
import { VERIFY_URL_TIMEOUT_MS } from '@/lib/apiLimits';

/**
 * SSRF-Hardened Source Verification Endpoint
 *
 * Security Features:
 * - HTTPS-only URLs
 * - Private IP range blocking (localhost, 10.x, 192.168.x, 127.x, 169.254.x, etc.)
 * - DNS resolution checks for private IPs
 * - URL credential rejection
 * - URL length validation (max 2048 chars)
 * - Request limit (max 10 URLs per request)
 * - Rate limiting (10 requests per IP per minute)
 * - Concurrency limiting (3 parallel fetches max)
 * - Redirect limiting (max 2 redirects)
 * - Timeout enforcement (5 seconds per URL)
 * - No body downloads (HEAD + Range requests only)
 *
 * IMPORTANT: Uses Node.js runtime for DNS/Net APIs (not Edge)
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

// Rate limiter: 10 requests per IP per minute
const rateLimiter = new RateLimiter(10, 60000);

// Maximum URLs per request
const MAX_URLS_PER_REQUEST = 10;

// Maximum concurrent fetches
const MAX_CONCURRENT_FETCHES = 3;

interface Source {
  title: string;
  url: string;
  description?: string;
}

interface VerifyRequest {
  sources: Source[];
}

interface VerificationResult {
  url: string;
  title: string;
  ok: boolean;
  status: number;
  finalUrl: string;
  error?: string;
  isTrustedDomain: boolean;
}

const TRUSTED_DOMAINS = [
  'wikipedia.org',
  'rijksoverheid.nl',
  'cbs.nl',
  'kennisnet.nl',
  'lesmateriaal.nu',
  'knaw.nl',
  'nu.nl',
  'nos.nl',
  'nrc.nl',
  'trouw.nl',
  'volkskrant.nl',
  'scientias.nl',
  'nature.com',
  'science.org',
  '.gov',
  '.edu',
];

function isTrustedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return TRUSTED_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Verify a single source with SSRF protection
 */
async function verifySource(source: Source): Promise<VerificationResult> {
  const { url, title } = source;

  // Validate URL safety (SSRF protection)
  try {
    await assertUrlIsSafe(url, { maxLength: 2048 });
  } catch (error) {
    return {
      url,
      title,
      ok: false,
      status: 0,
      finalUrl: url,
      error: error instanceof Error ? error.message : 'URL validation failed',
      isTrustedDomain: false,
    };
  }

  // Check if domain is trusted
  const trusted = isTrustedDomain(url);

  // Safely fetch URL
  const result = await safeFetch(url, {
    timeout: VERIFY_URL_TIMEOUT_MS,
    maxRedirects: 2,
  });

  return {
    url,
    title,
    ok: result.ok,
    status: result.status,
    finalUrl: result.finalUrl,
    error: result.error,
    isTrustedDomain: trusted,
  };
}

/**
 * Process sources with concurrency limit
 *
 * Limits parallel fetches to prevent overwhelming the server or external hosts.
 */
async function processSourcesWithLimit(
  sources: Source[],
  limit: number
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const queue = [...sources];

  // Process in batches
  while (queue.length > 0) {
    const batch = queue.splice(0, limit);
    const batchResults = await Promise.all(batch.map(verifySource));
    results.push(...batchResults);
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const clientIp = getClientIp(request.headers);
    if (!rateLimiter.check(clientIp)) {
      const resetTime = Math.ceil(rateLimiter.getResetTime(clientIp) / 1000);
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${resetTime} seconds.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': resetTime.toString(),
          },
        }
      );
    }

    // Parse request body
    const body: VerifyRequest = await request.json();
    const { sources } = body;

    // Validate sources array
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: sources array required' },
        { status: 400 }
      );
    }

    // Limit number of sources
    if (sources.length > MAX_URLS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: 'Too many sources',
          message: `Maximum ${MAX_URLS_PER_REQUEST} sources per request. Received ${sources.length}.`,
        },
        { status: 400 }
      );
    }

    // Verify all sources with concurrency limit
    const results = await processSourcesWithLimit(sources, MAX_CONCURRENT_FETCHES);

    // Calculate statistics
    const stats = {
      total: results.length,
      verified: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      trusted: results.filter((r) => r.isTrustedDomain).length,
    };

    return NextResponse.json({
      results,
      stats,
    });
  } catch (error) {
    console.error('Verify sources error:', error);

    // Never expose internal error details to client
    return NextResponse.json(
      {
        error: 'Failed to verify sources',
        message: 'An internal error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
