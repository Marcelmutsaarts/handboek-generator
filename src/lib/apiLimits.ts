/**
 * Centralized API timeout and maxDuration configuration
 *
 * All API routes should use these constants for consistent behavior
 * and easier maintenance.
 *
 * IMPORTANT: These values are based on actual API performance characteristics.
 * Only change if you have verified the new values work across all deployment environments.
 */

// OpenRouter AI generation timeouts (ms)
export const OPENROUTER_TEXT_TIMEOUT_MS = 120_000;      // 2 minutes - generate (full chapter)
export const OPENROUTER_QUALITY_TIMEOUT_MS = 90_000;    // 1.5 minutes - quality-check, improve-content
export const OPENROUTER_SOURCES_TIMEOUT_MS = 110_000;   // ~2 minutes - regenerate-sources
export const OPENROUTER_IMAGE_TIMEOUT_MS = 60_000;      // 1 minute - generate-image, generate-cover
export const OPENROUTER_REWRITE_TIMEOUT_MS = 60_000;    // 1 minute - rewrite
export const OPENROUTER_STRUCTURE_TIMEOUT_MS = 30_000;  // 30 seconds - generate-structure
export const OPENROUTER_CAPTION_TIMEOUT_MS = 15_000;    // 15 seconds - generate-caption

// External API timeouts (ms)
export const PEXELS_TIMEOUT_MS = 10_000;                // 10 seconds - images (stock photos)
export const VERIFY_URL_TIMEOUT_MS = 5_000;             // 5 seconds - verify-sources per URL

// Next.js/Vercel maxDuration settings (seconds)
// See: https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration
export const DEFAULT_MAX_DURATION_SECONDS = 120;        // 2 minutes - most AI routes
export const VERIFY_MAX_DURATION_SECONDS = 30;          // 30 seconds - verify-sources

/**
 * Helper to create AbortController with timeout
 *
 * Usage:
 * ```typescript
 * const controller = createTimeoutController(OPENROUTER_TEXT_TIMEOUT_MS);
 * fetch(url, { signal: controller.signal });
 * ```
 */
export function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

/**
 * Helper to log timeout aborts safely (no secrets)
 *
 * Usage:
 * ```typescript
 * try {
 *   await fetch(url, { signal });
 * } catch (error) {
 *   if (error instanceof Error && error.name === 'AbortError') {
 *     logTimeoutAbort('generate', OPENROUTER_TEXT_TIMEOUT_MS);
 *   }
 * }
 * ```
 */
export function logTimeoutAbort(routeName: string, timeoutMs: number): void {
  console.warn(`[Timeout] ${routeName} aborted after ${timeoutMs}ms`);
}
