/**
 * Token budget estimation for AI text generation
 *
 * Dynamically computes max_tokens based on desired output length,
 * reducing latency and cost compared to fixed high limits.
 *
 * Heuristics (no external tokenizer required):
 * - ~0.75 words per token (or ~1.33 tokens per word)
 * - ~4 characters per token
 * - Add safety margin for formatting, structure, image placeholders, sources
 */

import { Lengte, FormData, TemplateSection, WOORDEN_PER_LENGTE, getTemplate } from '@/types';

/**
 * Default word counts per length setting (fallback if not in types)
 */
const DEFAULT_WORD_COUNTS: Record<Lengte, number> = {
  kort: 800,
  medium: 1500,
  lang: 2500,
};

/**
 * Token conversion heuristics
 */
const TOKENS_PER_WORD = 1.33; // ~0.75 words per token
const CHARS_PER_TOKEN = 4;

/**
 * Safety margins and limits
 */
const SAFETY_MARGIN_PERCENTAGE = 0.30; // 30% extra for formatting, structure
const MIN_MAX_TOKENS = 600; // Minimum reasonable output
const DEFAULT_MAX_TOKENS = 1500; // Sensible default (was 8192)
const ABSOLUTE_MAX_TOKENS = 4096; // Hard cap to avoid excessive cost/latency

/**
 * Estimate max_tokens for text generation based on request parameters
 *
 * @param formData - Chapter generation parameters
 * @param eerdereHoofdstukkenCount - Number of previous chapters (affects context size)
 * @returns Estimated max_tokens value, clamped to safe limits
 */
export function estimateMaxTokens(
  formData: FormData,
  eerdereHoofdstukkenCount: number = 0
): number {
  try {
    // 1. Determine target word count
    let targetWords: number;

    if (formData.woordenAantal && formData.woordenAantal > 0) {
      // Use custom word count if provided
      targetWords = formData.woordenAantal;
    } else {
      // Fall back to length preset
      targetWords = WOORDEN_PER_LENGTE[formData.lengte] || DEFAULT_WORD_COUNTS[formData.lengte] || 1500;
    }

    // 2. Count sections to estimate structural overhead
    let sectionCount = 6; // Default estimate

    if (formData.template === 'custom' && formData.customSecties) {
      sectionCount = formData.customSecties.length;
    } else {
      const template = getTemplate(formData.template);
      if (template) {
        sectionCount = template.secties.filter(s => s.verplicht).length;
      }
    }

    // 3. Estimate base tokens from target words
    const baseTokens = Math.ceil(targetWords * TOKENS_PER_WORD);

    // 4. Add overhead for structure and features
    let overhead = 0;

    // Section headers and formatting (~50 tokens per section)
    overhead += sectionCount * 50;

    // Image placeholders if enabled (~30 tokens per placeholder, estimate 3-6 images)
    if (formData.metAfbeeldingen) {
      const estimatedImages = Math.min(sectionCount, 6);
      overhead += estimatedImages * 30;
    }

    // Sources section if enabled (~200-400 tokens)
    if (formData.metBronnen) {
      overhead += 300;
    }

    // Additional overhead for earlier chapters context (reduces output budget slightly)
    if (eerdereHoofdstukkenCount > 0) {
      overhead += 100; // Small reduction for context awareness
    }

    // 5. Apply safety margin
    const totalTokens = baseTokens + overhead;
    const withMargin = Math.ceil(totalTokens * (1 + SAFETY_MARGIN_PERCENTAGE));

    // 6. Clamp to reasonable limits
    const clamped = Math.max(
      MIN_MAX_TOKENS,
      Math.min(withMargin, ABSOLUTE_MAX_TOKENS)
    );

    // 7. Log decision in development (no secrets)
    if (process.env.NODE_ENV === 'development') {
      console.log('[TokenBudget]', {
        targetWords,
        sectionCount,
        baseTokens,
        overhead,
        withMargin,
        clamped,
        template: formData.template,
        metBronnen: formData.metBronnen,
        metAfbeeldingen: formData.metAfbeeldingen,
      });
    }

    return clamped;
  } catch (error) {
    // Fallback on any error
    console.warn('[TokenBudget] Estimation failed, using default:', error);
    return DEFAULT_MAX_TOKENS;
  }
}

/**
 * Generate length guidance string for prompt injection
 *
 * Adds explicit word count constraints to the prompt without changing structure.
 *
 * @param formData - Chapter generation parameters
 * @returns Short instruction string to append to prompt
 */
export function getLengthGuidance(formData: FormData): string {
  let targetWords: number;

  if (formData.woordenAantal && formData.woordenAantal > 0) {
    targetWords = formData.woordenAantal;
  } else {
    targetWords = WOORDEN_PER_LENGTE[formData.lengte] || DEFAULT_WORD_COUNTS[formData.lengte] || 1500;
  }

  // Allow some flexibility (±15%)
  const minWords = Math.floor(targetWords * 0.85);
  const maxWords = Math.ceil(targetWords * 1.15);

  return `\n\nLENGTE VEREISTE: Schrijf ongeveer ${targetWords} woorden (tussen ${minWords}-${maxWords} woorden). Houd het compact maar compleet.`;
}

/**
 * Get human-readable explanation of token budget (for logging/debugging)
 */
export function explainTokenBudget(maxTokens: number, formData: FormData): string {
  const targetWords = formData.woordenAantal || WOORDEN_PER_LENGTE[formData.lengte] || 1500;
  const estimatedWords = Math.floor(maxTokens / TOKENS_PER_WORD);

  return `max_tokens=${maxTokens} (target: ${targetWords} words, allows: ~${estimatedWords} words with overhead)`;
}
