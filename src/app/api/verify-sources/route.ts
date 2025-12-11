import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const maxDuration = 30;

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
  status: 'verified' | 'unreachable' | 'invalid' | 'suspicious';
  message: string;
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

async function verifyUrl(url: string, signal: AbortSignal): Promise<{ reachable: boolean; statusCode?: number }> {
  try {
    // Try HEAD request first (faster, less bandwidth)
    const response = await fetch(url, {
      method: 'HEAD',
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HandboekGenerator/1.0; +https://handboek-generator.vercel.app)',
      },
    });

    return {
      reachable: response.ok,
      statusCode: response.status,
    };
  } catch (error) {
    // If HEAD fails, try GET (some servers don't support HEAD)
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HandboekGenerator/1.0; +https://handboek-generator.vercel.app)',
        },
      });

      return {
        reachable: response.ok,
        statusCode: response.status,
      };
    } catch {
      return { reachable: false };
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json();
    const { sources } = body;

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: sources array required' },
        { status: 400 }
      );
    }

    // Limit to 20 sources to prevent abuse
    if (sources.length > 20) {
      return NextResponse.json(
        { error: 'Too many sources. Maximum 20 sources per request.' },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    // Verify all sources concurrently
    const verificationPromises = sources.map(async (source): Promise<VerificationResult> => {
      // Validate URL format
      let urlObj: URL;
      try {
        urlObj = new URL(source.url);
      } catch {
        return {
          url: source.url,
          title: source.title,
          status: 'invalid',
          message: 'Ongeldige URL format',
          isTrustedDomain: false,
        };
      }

      // Check if domain is trusted
      const trusted = isTrustedDomain(source.url);

      // Verify URL is reachable
      const { reachable, statusCode } = await verifyUrl(source.url, controller.signal);

      if (reachable) {
        return {
          url: source.url,
          title: source.title,
          status: 'verified',
          message: trusted
            ? 'Geverifieerd en betrouwbaar domein'
            : 'Bereikbaar, maar domein niet in betrouwbare lijst',
          isTrustedDomain: trusted,
        };
      } else if (statusCode === 404) {
        return {
          url: source.url,
          title: source.title,
          status: 'unreachable',
          message: 'Pagina niet gevonden (404)',
          isTrustedDomain: trusted,
        };
      } else if (statusCode === 403 || statusCode === 401) {
        return {
          url: source.url,
          title: source.title,
          status: 'suspicious',
          message: 'Toegang geweigerd - mogelijk bestaande pagina met toegangsbeperking',
          isTrustedDomain: trusted,
        };
      } else {
        return {
          url: source.url,
          title: source.title,
          status: 'unreachable',
          message: 'Niet bereikbaar',
          isTrustedDomain: trusted,
        };
      }
    });

    const results = await Promise.all(verificationPromises);
    clearTimeout(timeoutId);

    // Calculate statistics
    const stats = {
      total: results.length,
      verified: results.filter((r) => r.status === 'verified').length,
      unreachable: results.filter((r) => r.status === 'unreachable').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
      suspicious: results.filter((r) => r.status === 'suspicious').length,
      trusted: results.filter((r) => r.isTrustedDomain).length,
    };

    return NextResponse.json({
      results,
      stats,
    });
  } catch (error) {
    console.error('Verify sources error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Verificatie timeout - probeer opnieuw' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to verify sources', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
