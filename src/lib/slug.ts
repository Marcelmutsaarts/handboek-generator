/**
 * Slug Validation and Normalization
 *
 * Provides strict slug validation to prevent path traversal, injection attacks,
 * and other security issues in file storage paths.
 *
 * Security Rationale:
 * - Prevents path traversal attacks (../, ../../, etc.)
 * - Prevents directory injection (a/b, subdirectories)
 * - Prevents encoded path separators (%2f, %5c)
 * - Prevents whitespace and special characters
 * - Ensures predictable, safe file paths in storage
 *
 * Attack Scenarios Prevented:
 * 1. Path Traversal: "../etc/passwd" → Rejected
 * 2. Directory Injection: "user/admin" → Rejected
 * 3. Encoded Slashes: "user%2fadmin" → Rejected
 * 4. Double Encoding: "user%252fadmin" → Rejected
 * 5. Backslash (Windows): "user\admin" → Rejected
 * 6. Whitespace: "user admin" → Rejected
 * 7. Special Chars: "user__admin" → Rejected (double underscore not allowed)
 *
 * Safe Examples:
 * - "geschiedenis-vmbo1" ✅
 * - "wiskunde-havo-3" ✅
 * - "natuur-en-techniek" ✅
 */

const MAX_SLUG_LENGTH = 60;

/**
 * Validate that a slug is safe for use in file paths
 *
 * Rules:
 * - Lowercase only
 * - Max 60 characters
 * - Allowed characters: a-z, 0-9, hyphen (-)
 * - Must start with letter or number
 * - Must not end with hyphen
 * - Must not contain: /, \, .., %2f, %5c, whitespace
 *
 * @throws Error if slug is invalid
 */
export function assertValidSlug(slug: string): void {
  // Check if slug exists
  if (!slug || typeof slug !== 'string') {
    throw new Error('Slug is required and must be a string');
  }

  // Check length
  if (slug.length === 0) {
    throw new Error('Slug cannot be empty');
  }

  if (slug.length > MAX_SLUG_LENGTH) {
    throw new Error(`Slug is too long (max ${MAX_SLUG_LENGTH} characters)`);
  }

  // Check for lowercase only
  if (slug !== slug.toLowerCase()) {
    throw new Error('Slug must be lowercase');
  }

  // Check for dangerous path separators (raw)
  if (slug.includes('/')) {
    throw new Error('Slug cannot contain forward slashes (/)');
  }

  if (slug.includes('\\')) {
    throw new Error('Slug cannot contain backslashes (\\)');
  }

  // Check for encoded path separators (case-insensitive)
  const lowerSlug = slug.toLowerCase();
  if (lowerSlug.includes('%2f') || lowerSlug.includes('%5c')) {
    throw new Error('Slug cannot contain encoded path separators');
  }

  // Check for percent encoding at all (to prevent double-encoding bypasses)
  if (slug.includes('%')) {
    throw new Error('Slug cannot contain percent-encoded characters');
  }

  // Check for path traversal attempts
  if (slug.includes('..')) {
    throw new Error('Slug cannot contain ".." (path traversal attempt)');
  }

  // Check for whitespace
  if (/\s/.test(slug)) {
    throw new Error('Slug cannot contain whitespace');
  }

  // Check allowed characters: a-z, 0-9, hyphen
  // Must start with letter or number, cannot end with hyphen
  const slugPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

  if (!slugPattern.test(slug)) {
    // More specific error messages
    if (!/^[a-z0-9]/.test(slug)) {
      throw new Error('Slug must start with a letter or number');
    }
    if (slug.endsWith('-')) {
      throw new Error('Slug cannot end with a hyphen');
    }
    // Check for invalid characters
    const invalidChars = slug.match(/[^a-z0-9-]/g);
    if (invalidChars) {
      throw new Error(
        `Slug contains invalid characters: ${[...new Set(invalidChars)].join(', ')}`
      );
    }
    throw new Error('Slug contains invalid format');
  }

  // Additional check: no consecutive hyphens (optional, for URL aesthetics)
  if (slug.includes('--')) {
    throw new Error('Slug cannot contain consecutive hyphens');
  }

  // All checks passed
}

/**
 * Normalize user input to a safe slug
 *
 * This is optional - use if you want to accept "nice" user input and convert it to safe slugs.
 * Still enforces strict rules after normalization.
 *
 * Transformations:
 * - Converts to lowercase
 * - Replaces spaces and underscores with hyphens
 * - Removes invalid characters
 * - Trims to max length
 * - Ensures starts/ends with alphanumeric
 *
 * Examples:
 * - "Geschiedenis VMBO 1" → "geschiedenis-vmbo-1"
 * - "Natuur & Techniek" → "natuur-techniek"
 * - "Wiskunde__A" → "wiskunde-a"
 */
export function normalizeSlug(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Input is required and must be a string');
  }

  let slug = input
    // Convert to lowercase
    .toLowerCase()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove invalid characters (keep only a-z, 0-9, hyphen)
    .replace(/[^a-z0-9-]/g, '')
    // Replace consecutive hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');

  // Trim to max length
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.substring(0, MAX_SLUG_LENGTH);
    // Ensure doesn't end with hyphen after trimming
    slug = slug.replace(/-+$/, '');
  }

  // Validate the normalized result
  assertValidSlug(slug);

  return slug;
}

/**
 * Check if a string is a valid slug (without throwing)
 *
 * Returns true if valid, false otherwise.
 * Useful for conditional logic where you don't want exceptions.
 */
export function isValidSlug(slug: string): boolean {
  try {
    assertValidSlug(slug);
    return true;
  } catch {
    return false;
  }
}

/**
 * Test helper to verify slug validation
 *
 * Returns test results for dangerous and safe slugs.
 * Useful for quick verification during development.
 */
export function testSlugValidation(): {
  passed: boolean;
  results: Array<{ slug: string; shouldBlock: boolean; blocked: boolean; error?: string }>;
} {
  const dangerousSlugs = [
    { slug: '../x', reason: 'Path traversal' },
    { slug: 'a/b', reason: 'Directory injection' },
    { slug: 'a%2fb', reason: 'Encoded forward slash' },
    { slug: 'a%5cb', reason: 'Encoded backslash' },
    { slug: 'a b', reason: 'Whitespace' },
    { slug: 'a__b', reason: 'Double underscore' },
    { slug: 'a..b', reason: 'Double dots' },
    { slug: '-start', reason: 'Starts with hyphen' },
    { slug: 'end-', reason: 'Ends with hyphen' },
    { slug: 'UPPERCASE', reason: 'Uppercase letters' },
    { slug: 'a--b', reason: 'Consecutive hyphens' },
    { slug: '', reason: 'Empty string' },
    { slug: 'a'.repeat(61), reason: 'Too long' },
  ];

  const safeSlugs = [
    { slug: 'geschiedenis-vmbo1' },
    { slug: 'wiskunde-havo-3' },
    { slug: 'natuur-en-techniek' },
    { slug: 'a' },
    { slug: '1' },
    { slug: 'a1b2c3' },
    { slug: 'test-123' },
  ];

  const results: Array<{ slug: string; shouldBlock: boolean; blocked: boolean; error?: string }> = [];

  // Test dangerous slugs (should be blocked)
  for (const { slug } of dangerousSlugs) {
    try {
      assertValidSlug(slug);
      results.push({ slug, shouldBlock: true, blocked: false });
    } catch (error) {
      results.push({
        slug,
        shouldBlock: true,
        blocked: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Test safe slugs (should be allowed)
  for (const { slug } of safeSlugs) {
    try {
      assertValidSlug(slug);
      results.push({ slug, shouldBlock: false, blocked: false });
    } catch (error) {
      results.push({
        slug,
        shouldBlock: false,
        blocked: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // All tests pass if dangerous slugs are blocked and safe slugs are allowed
  const passed = results.every((r) => r.shouldBlock === r.blocked);

  return { passed, results };
}
