/**
 * Simple in-memory rate limiter
 *
 * Uses a fixed window algorithm to limit requests per IP address.
 * This is a basic implementation suitable for single-instance deployments.
 *
 * For production with multiple instances, consider:
 * - Redis-based rate limiting
 * - Vercel Edge Config or KV
 * - Upstash Rate Limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if a request should be allowed
   *
   * @param key - Identifier (e.g., IP address)
   * @returns true if allowed, false if rate limited
   */
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    // No entry or expired entry - allow and create new
    if (!entry || now >= entry.resetAt) {
      this.store.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    // Entry exists and not expired
    if (entry.count < this.maxRequests) {
      entry.count++;
      return true;
    }

    // Rate limit exceeded
    return false;
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const entry = this.store.get(key);
    if (!entry || Date.now() >= entry.resetAt) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.count);
  }

  /**
   * Get reset time for a key (milliseconds)
   */
  getResetTime(key: string): number {
    const entry = this.store.get(key);
    if (!entry || Date.now() >= entry.resetAt) {
      return 0;
    }
    return entry.resetAt - Date.now();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Get client IP from Next.js request
 *
 * Checks headers in this order:
 * 1. x-forwarded-for (first IP)
 * 2. x-real-ip
 * 3. Remote address from headers
 *
 * Returns 'unknown' if IP cannot be determined
 */
export function getClientIp(headers: Headers): string {
  // Check x-forwarded-for (proxy/CDN)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP (client IP before proxies)
    const ip = forwardedFor.split(',')[0].trim();
    if (ip) return ip;
  }

  // Check x-real-ip
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;

  // Fallback
  return 'unknown';
}
