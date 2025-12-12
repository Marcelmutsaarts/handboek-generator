/**
 * Simple in-memory TTL (Time-To-Live) cache for serverless environments
 *
 * IMPORTANT LIMITATIONS:
 * - This is a BEST-EFFORT cache with NO persistence guarantees
 * - In serverless (Vercel/Lambda), memory is NOT shared across instances
 * - Cache lifetime is tied to the function instance lifecycle
 * - Cold starts reset the cache completely
 * - Use only for non-critical performance optimizations
 *
 * Design:
 * - Automatic expiry on get() (lazy deletion)
 * - Periodic cleanup to prevent memory leaks
 * - Safe fallback on errors (returns null)
 * - Lightweight logging in development
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in milliseconds
}

class TTLCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private cleanupIntervalMs = 5 * 60 * 1000; // Cleanup every 5 minutes
  private lastCleanup = Date.now();

  /**
   * Get a value from cache if not expired
   *
   * @param key - Cache key
   * @returns Cached value or null if expired/missing
   */
  get(key: string): T | null {
    try {
      // Lazy cleanup check
      this.maybeCleanup();

      const entry = this.cache.get(key);
      if (!entry) {
        this.logCacheMiss(key);
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        this.logCacheExpired(key);
        return null;
      }

      this.logCacheHit(key);
      return entry.value;
    } catch (error) {
      // Safe fallback: treat errors as cache miss
      console.warn('[TTLCache] Get error:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Time to live in milliseconds
   */
  set(key: string, value: T, ttlMs: number): void {
    try {
      const expiresAt = Date.now() + ttlMs;
      this.cache.set(key, { value, expiresAt });

      if (process.env.NODE_ENV === 'development') {
        console.log('[TTLCache] Set:', this.hashKey(key), `(TTL: ${ttlMs}ms)`);
      }
    } catch (error) {
      // Safe fallback: silently fail to cache
      console.warn('[TTLCache] Set error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Manually delete a key from cache
   *
   * @param key - Cache key to delete
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.lastCleanup = Date.now();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()).map(k => this.hashKey(k))
    };
  }

  /**
   * Periodic cleanup of expired entries to prevent memory leaks
   * Only runs if enough time has passed since last cleanup
   */
  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }

    let expired = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expired++;
      }
    }

    this.lastCleanup = now;

    if (expired > 0 && process.env.NODE_ENV === 'development') {
      console.log(`[TTLCache] Cleanup: removed ${expired} expired entries, ${this.cache.size} remaining`);
    }
  }

  /**
   * Hash a cache key for logging (privacy-safe)
   * Shows first 8 chars of hash instead of full key
   */
  private hashKey(key: string): string {
    // Simple hash for logging (not cryptographic)
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  private logCacheHit(key: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TTLCache] HIT:', this.hashKey(key));
    }
  }

  private logCacheMiss(key: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TTLCache] MISS:', this.hashKey(key));
    }
  }

  private logCacheExpired(key: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TTLCache] EXPIRED:', this.hashKey(key));
    }
  }
}

/**
 * Normalize a search query for consistent cache keys
 *
 * @param query - Search query string
 * @returns Normalized query (trimmed, lowercase)
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Normalize a URL for consistent cache keys
 * Lowercase hostname while preserving path/query case
 *
 * @param url - URL string
 * @returns Normalized URL or original on error
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Lowercase protocol and hostname, keep path/query as-is
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString();
  } catch {
    // Invalid URL: return original (will likely fail downstream anyway)
    return url;
  }
}

// Export singleton instances for different cache purposes
// Each cache is independent to avoid key collisions

/**
 * Cache for image search results from Pexels API
 * TTL: 6 hours (images don't change frequently)
 */
export const imageCache = new TTLCache<unknown>();

/**
 * Cache for URL verification results
 * TTL: 1 hour (shorter, as availability can change)
 */
export const urlVerificationCache = new TTLCache<{
  ok: boolean;
  status?: number;
  finalUrl?: string;
  error?: string;
}>();

// Export class for testing/custom instances
export { TTLCache };
