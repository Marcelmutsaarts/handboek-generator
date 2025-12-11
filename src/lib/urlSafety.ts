/**
 * URL Safety Utilities for SSRF Protection
 *
 * This module provides utilities to validate URLs and prevent Server-Side Request Forgery (SSRF) attacks.
 * It blocks requests to private/internal networks, localhost, and suspicious URLs.
 *
 * SSRF Protection Features:
 * - HTTPS-only enforcement
 * - Private IP range detection (IPv4 and IPv6)
 * - DNS resolution checks for private IPs
 * - Localhost/loopback blocking
 * - Link-local address blocking
 * - URL credential rejection
 * - URL length validation
 *
 * Limitations:
 * - DNS-based checks can be bypassed with DNS rebinding attacks (use short TTLs + re-resolve)
 * - Time-of-check-time-of-use (TOCTOU) race conditions possible
 * - Some cloud metadata endpoints may not be caught by IP checks alone
 * - Consider implementing egress filtering at network level for defense-in-depth
 */

import dns from 'dns/promises';

/**
 * Check if an IP address falls within a private/internal range
 *
 * Blocks:
 * - Loopback: 127.0.0.0/8, ::1
 * - Private IPv4: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - Link-local: 169.254.0.0/16, fe80::/10
 * - Private IPv6: fc00::/7
 * - Localhost
 */
export function isPrivateIp(ip: string): boolean {
  // Normalize
  const normalized = ip.toLowerCase().trim();

  // Check for localhost variations
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    normalized === '0.0.0.0'
  ) {
    return true;
  }

  // IPv4 checks
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = normalized.match(ipv4Regex);

  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);

    // Validate octets are in range 0-255
    if (octets.some((octet) => octet < 0 || octet > 255)) {
      return true; // Invalid IP, treat as private for safety
    }

    const [a, b, c, d] = octets;

    // 127.0.0.0/8 - Loopback
    if (a === 127) return true;

    // 10.0.0.0/8 - Private
    if (a === 10) return true;

    // 172.16.0.0/12 - Private
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 - Private
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 - Link-local
    if (a === 169 && b === 254) return true;

    // 0.0.0.0/8 - Current network
    if (a === 0) return true;

    // 255.255.255.255 - Broadcast
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;

    return false;
  }

  // IPv6 checks (simplified)
  if (normalized.includes(':')) {
    // ::1 - Loopback (already checked above)
    if (normalized === '::1' || normalized === '::') return true;

    // fc00::/7 - Unique local addresses (private)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    // fe80::/10 - Link-local
    if (normalized.startsWith('fe80:')) return true;

    // ff00::/8 - Multicast
    if (normalized.startsWith('ff')) return true;

    return false;
  }

  // If we can't parse it, treat as potentially dangerous
  return true;
}

/**
 * Resolve a hostname to IP addresses using DNS
 *
 * Returns both A (IPv4) and AAAA (IPv6) records.
 * Throws if DNS resolution fails.
 */
export async function resolveHost(hostname: string): Promise<string[]> {
  // If it's already an IP, return it
  if (isIpAddress(hostname)) {
    return [hostname];
  }

  const results: string[] = [];

  try {
    // Resolve IPv4 (A records)
    const ipv4Addresses = await dns.resolve4(hostname);
    results.push(...ipv4Addresses);
  } catch (error) {
    // Ignore IPv4 resolution failures, try IPv6
  }

  try {
    // Resolve IPv6 (AAAA records)
    const ipv6Addresses = await dns.resolve6(hostname);
    results.push(...ipv6Addresses);
  } catch (error) {
    // Ignore IPv6 resolution failures
  }

  // If no results, DNS resolution failed completely
  if (results.length === 0) {
    throw new Error(`DNS resolution failed for ${hostname}`);
  }

  return results;
}

/**
 * Check if a string is an IP address (IPv4 or IPv6)
 */
function isIpAddress(str: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4Pattern.test(str)) {
    const octets = str.split('.').map(Number);
    return octets.every((octet) => octet >= 0 && octet <= 255);
  }

  // IPv6 pattern (simplified - just check for colons)
  return str.includes(':');
}

/**
 * Assert that a URL is safe to fetch
 *
 * Performs comprehensive validation:
 * 1. URL format validation
 * 2. HTTPS-only enforcement
 * 3. Credentials rejection
 * 4. Length validation
 * 5. IP literal check for private ranges
 * 6. DNS resolution check for private IPs
 *
 * Throws an error if the URL is unsafe.
 */
export async function assertUrlIsSafe(urlString: string, options?: { maxLength?: number }): Promise<void> {
  const maxLength = options?.maxLength || 2048;

  // 1. Length check
  if (urlString.length > maxLength) {
    throw new Error(`URL too long (max ${maxLength} characters)`);
  }

  // 2. Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (error) {
    throw new Error('Invalid URL format');
  }

  // 3. HTTPS-only
  if (url.protocol !== 'https:') {
    throw new Error(`Only HTTPS URLs are allowed (got ${url.protocol})`);
  }

  // 4. No credentials in URL
  if (url.username || url.password) {
    throw new Error('URLs with credentials are not allowed');
  }

  // 5. Extract hostname
  const hostname = url.hostname.toLowerCase();

  // 6. Check if hostname is an IP literal
  if (isIpAddress(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Private/internal IP addresses are not allowed');
    }
    // IP is public, allow it
    return;
  }

  // 7. Resolve DNS and check all IPs
  let resolvedIps: string[];
  try {
    resolvedIps = await resolveHost(hostname);
  } catch (error) {
    throw new Error(`DNS resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 8. Check if ANY resolved IP is private (fail-closed)
  const privateIps = resolvedIps.filter(isPrivateIp);
  if (privateIps.length > 0) {
    throw new Error(
      `Hostname resolves to private/internal IP addresses: ${privateIps.join(', ')}`
    );
  }

  // All checks passed
}

/**
 * Validate an array of URLs for safety
 *
 * Returns an object with:
 * - validUrls: URLs that passed validation
 * - invalidUrls: URLs that failed validation with error messages
 */
export async function validateUrls(
  urls: string[],
  options?: { maxLength?: number; maxCount?: number }
): Promise<{
  validUrls: string[];
  invalidUrls: Array<{ url: string; error: string }>;
}> {
  const maxCount = options?.maxCount || 10;

  if (urls.length > maxCount) {
    throw new Error(`Too many URLs (max ${maxCount})`);
  }

  const validUrls: string[] = [];
  const invalidUrls: Array<{ url: string; error: string }> = [];

  // Validate sequentially to avoid overwhelming DNS servers
  for (const url of urls) {
    try {
      await assertUrlIsSafe(url, options);
      validUrls.push(url);
    } catch (error) {
      invalidUrls.push({
        url,
        error: error instanceof Error ? error.message : 'Validation failed',
      });
    }
  }

  return { validUrls, invalidUrls };
}

/**
 * Create a fetch wrapper with safety features
 *
 * - HEAD request with timeout
 * - Limited redirects (max 2)
 * - No body download
 * - Safe headers
 */
export async function safeFetch(
  url: string,
  options?: {
    timeout?: number;
    maxRedirects?: number;
  }
): Promise<{
  ok: boolean;
  status: number;
  finalUrl: string;
  error?: string;
}> {
  const timeout = options?.timeout || 5000;
  const maxRedirects = options?.maxRedirects || 2;

  // Validate URL first
  try {
    await assertUrlIsSafe(url);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      error: error instanceof Error ? error.message : 'URL validation failed',
    };
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Try HEAD first (faster, no body)
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual', // Handle redirects manually to count them
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HandboekGenerator/1.0)',
      },
    });

    clearTimeout(timeoutId);

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return {
          ok: false,
          status: response.status,
          finalUrl: url,
          error: 'Redirect without location header',
        };
      }

      // Check redirect count
      if (maxRedirects <= 0) {
        return {
          ok: false,
          status: response.status,
          finalUrl: url,
          error: 'Too many redirects',
        };
      }

      // Resolve relative URL
      const redirectUrl = new URL(location, url).href;

      // Recursively follow redirect with decremented count
      return safeFetch(redirectUrl, {
        timeout,
        maxRedirects: maxRedirects - 1,
      });
    }

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: url,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // If HEAD fails, try GET with Range header (minimal download)
    if (error instanceof Error && error.name !== 'AbortError') {
      try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), timeout);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller2.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HandboekGenerator/1.0)',
            Range: 'bytes=0-0', // Request only first byte
          },
        });

        clearTimeout(timeoutId2);

        // Handle redirects for GET too
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location || maxRedirects <= 0) {
            return {
              ok: false,
              status: response.status,
              finalUrl: url,
              error: maxRedirects <= 0 ? 'Too many redirects' : 'Redirect without location',
            };
          }

          const redirectUrl = new URL(location, url).href;
          return safeFetch(redirectUrl, { timeout, maxRedirects: maxRedirects - 1 });
        }

        return {
          ok: response.ok || response.status === 206, // 206 Partial Content is ok
          status: response.status,
          finalUrl: url,
        };
      } catch (error2) {
        return {
          ok: false,
          status: 0,
          finalUrl: url,
          error: error2 instanceof Error && error2.name === 'AbortError'
            ? 'Request timeout'
            : 'Network error',
        };
      }
    }

    return {
      ok: false,
      status: 0,
      finalUrl: url,
      error: error instanceof Error && error.name === 'AbortError'
        ? 'Request timeout'
        : 'Network error',
    };
  }
}
