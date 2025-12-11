/**
 * Slug Validation Tests
 *
 * Verifies that slug validation correctly blocks dangerous slugs
 * and allows safe ones.
 */

import { assertValidSlug, normalizeSlug, isValidSlug, testSlugValidation } from '../slug';

describe('assertValidSlug', () => {
  describe('should block path traversal attempts', () => {
    it('blocks "../x"', () => {
      expect(() => assertValidSlug('../x')).toThrow('path traversal');
    });

    it('blocks "../../etc/passwd"', () => {
      expect(() => assertValidSlug('../../etc/passwd')).toThrow();
    });

    it('blocks "a..b"', () => {
      expect(() => assertValidSlug('a..b')).toThrow('..');
    });
  });

  describe('should block directory injection', () => {
    it('blocks "a/b"', () => {
      expect(() => assertValidSlug('a/b')).toThrow('forward slash');
    });

    it('blocks "user/admin/settings"', () => {
      expect(() => assertValidSlug('user/admin/settings')).toThrow('forward slash');
    });

    it('blocks "a\\b" (backslash)', () => {
      expect(() => assertValidSlug('a\\b')).toThrow('backslash');
    });
  });

  describe('should block encoded path separators', () => {
    it('blocks "a%2fb" (encoded forward slash)', () => {
      expect(() => assertValidSlug('a%2fb')).toThrow('encoded path separators');
    });

    it('blocks "a%2Fb" (uppercase encoded slash)', () => {
      expect(() => assertValidSlug('a%2Fb')).toThrow('encoded path separators');
    });

    it('blocks "a%5cb" (encoded backslash)', () => {
      expect(() => assertValidSlug('a%5cb')).toThrow('encoded path separators');
    });

    it('blocks "a%5Cb" (uppercase encoded backslash)', () => {
      expect(() => assertValidSlug('a%5Cb')).toThrow('encoded path separators');
    });

    it('blocks any percent encoding', () => {
      expect(() => assertValidSlug('a%20b')).toThrow('percent-encoded');
    });
  });

  describe('should block whitespace', () => {
    it('blocks "a b"', () => {
      expect(() => assertValidSlug('a b')).toThrow('whitespace');
    });

    it('blocks tabs', () => {
      expect(() => assertValidSlug('a\tb')).toThrow('whitespace');
    });

    it('blocks newlines', () => {
      expect(() => assertValidSlug('a\nb')).toThrow('whitespace');
    });
  });

  describe('should block invalid characters', () => {
    it('blocks double underscores', () => {
      expect(() => assertValidSlug('a__b')).toThrow();
    });

    it('blocks single underscore', () => {
      expect(() => assertValidSlug('a_b')).toThrow('invalid character');
    });

    it('blocks special characters', () => {
      expect(() => assertValidSlug('a@b')).toThrow('invalid character');
      expect(() => assertValidSlug('a#b')).toThrow('invalid character');
      expect(() => assertValidSlug('a$b')).toThrow('invalid character');
    });

    it('blocks consecutive hyphens', () => {
      expect(() => assertValidSlug('a--b')).toThrow('consecutive hyphens');
    });
  });

  describe('should enforce position rules', () => {
    it('blocks slugs starting with hyphen', () => {
      expect(() => assertValidSlug('-start')).toThrow('start with a letter or number');
    });

    it('blocks slugs ending with hyphen', () => {
      expect(() => assertValidSlug('end-')).toThrow('end with a hyphen');
    });

    it('allows single character', () => {
      expect(() => assertValidSlug('a')).not.toThrow();
      expect(() => assertValidSlug('1')).not.toThrow();
    });
  });

  describe('should enforce lowercase', () => {
    it('blocks uppercase letters', () => {
      expect(() => assertValidSlug('UPPERCASE')).toThrow('lowercase');
    });

    it('blocks mixed case', () => {
      expect(() => assertValidSlug('MixedCase')).toThrow('lowercase');
    });
  });

  describe('should enforce length limits', () => {
    it('blocks empty string', () => {
      expect(() => assertValidSlug('')).toThrow('empty');
    });

    it('blocks slugs > 60 characters', () => {
      const longSlug = 'a'.repeat(61);
      expect(() => assertValidSlug(longSlug)).toThrow('too long');
    });

    it('allows 60 characters', () => {
      const maxSlug = 'a'.repeat(60);
      expect(() => assertValidSlug(maxSlug)).not.toThrow();
    });
  });

  describe('should allow valid slugs', () => {
    it('allows "geschiedenis-vmbo1"', () => {
      expect(() => assertValidSlug('geschiedenis-vmbo1')).not.toThrow();
    });

    it('allows "wiskunde-havo-3"', () => {
      expect(() => assertValidSlug('wiskunde-havo-3')).not.toThrow();
    });

    it('allows "natuur-en-techniek"', () => {
      expect(() => assertValidSlug('natuur-en-techniek')).not.toThrow();
    });

    it('allows "a1b2c3"', () => {
      expect(() => assertValidSlug('a1b2c3')).not.toThrow();
    });

    it('allows "test-123"', () => {
      expect(() => assertValidSlug('test-123')).not.toThrow();
    });

    it('allows single letter', () => {
      expect(() => assertValidSlug('a')).not.toThrow();
    });

    it('allows single number', () => {
      expect(() => assertValidSlug('1')).not.toThrow();
    });
  });
});

describe('normalizeSlug', () => {
  it('converts to lowercase', () => {
    expect(normalizeSlug('UPPERCASE')).toBe('uppercase');
  });

  it('replaces spaces with hyphens', () => {
    expect(normalizeSlug('hello world')).toBe('hello-world');
  });

  it('replaces underscores with hyphens', () => {
    expect(normalizeSlug('hello_world')).toBe('hello-world');
  });

  it('removes invalid characters', () => {
    expect(normalizeSlug('hello@world#123')).toBe('helloworld123');
  });

  it('replaces consecutive hyphens', () => {
    expect(normalizeSlug('hello---world')).toBe('hello-world');
  });

  it('trims leading/trailing hyphens', () => {
    expect(normalizeSlug('-hello-world-')).toBe('hello-world');
  });

  it('handles complex input', () => {
    expect(normalizeSlug('Geschiedenis VMBO 1')).toBe('geschiedenis-vmbo-1');
  });

  it('truncates to max length', () => {
    const longInput = 'a'.repeat(100);
    const result = normalizeSlug(longInput);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('throws on empty result', () => {
    expect(() => normalizeSlug('@@@@')).toThrow();
  });
});

describe('isValidSlug', () => {
  it('returns true for valid slugs', () => {
    expect(isValidSlug('geschiedenis-vmbo1')).toBe(true);
    expect(isValidSlug('test-123')).toBe(true);
  });

  it('returns false for invalid slugs', () => {
    expect(isValidSlug('../x')).toBe(false);
    expect(isValidSlug('a/b')).toBe(false);
    expect(isValidSlug('a b')).toBe(false);
    expect(isValidSlug('-start')).toBe(false);
  });
});

describe('testSlugValidation', () => {
  it('should pass all validation tests', () => {
    const result = testSlugValidation();
    expect(result.passed).toBe(true);

    // Log results for manual inspection
    console.log('\n=== Slug Validation Test Results ===');
    result.results.forEach((r) => {
      const status = r.shouldBlock === r.blocked ? '✅' : '❌';
      const action = r.shouldBlock ? 'BLOCK' : 'ALLOW';
      const outcome = r.blocked ? 'BLOCKED' : 'ALLOWED';
      console.log(`${status} ${action}: "${r.slug}" → ${outcome}`);
      if (r.error) {
        console.log(`   Reason: ${r.error}`);
      }
    });
    console.log('=====================================\n');
  });
});

/**
 * Integration test: Verify specific attack scenarios
 */
describe('Security Attack Scenarios', () => {
  it('prevents path traversal to etc/passwd', () => {
    expect(() => assertValidSlug('../../../etc/passwd')).toThrow();
  });

  it('prevents accessing parent directory', () => {
    expect(() => assertValidSlug('..')).toThrow();
  });

  it('prevents subdirectory injection', () => {
    expect(() => assertValidSlug('uploads/../../sensitive')).toThrow();
  });

  it('prevents null byte injection', () => {
    // Null bytes would be in the invalid characters check
    expect(() => assertValidSlug('test\x00.html')).toThrow();
  });

  it('prevents URL-encoded attacks', () => {
    expect(() => assertValidSlug('test%2e%2e%2fpasswd')).toThrow();
  });

  it('prevents double-encoded attacks', () => {
    expect(() => assertValidSlug('test%252e%252e%252fpasswd')).toThrow();
  });
});

/**
 * Manual test runner
 */
export function runManualSlugTests(): void {
  console.log('🔒 Running Slug Validation Tests...\n');

  const dangerousSlugs = [
    '../x',
    'a/b',
    'a%2fb',
    'a b',
    'a__b',
    'a..b',
    '-start',
    'end-',
    'UPPERCASE',
  ];

  const safeSlugs = ['geschiedenis-vmbo1', 'wiskunde-havo-3', 'natuur-en-techniek'];

  console.log('Testing DANGEROUS slugs (should be blocked):\n');
  dangerousSlugs.forEach((slug) => {
    try {
      assertValidSlug(slug);
      console.log(`❌ FAIL: "${slug}" was NOT blocked!`);
    } catch (error) {
      console.log(`✅ PASS: "${slug}" blocked`);
      console.log(`   Reason: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  });

  console.log('\n\nTesting SAFE slugs (should be allowed):\n');
  safeSlugs.forEach((slug) => {
    try {
      assertValidSlug(slug);
      console.log(`✅ PASS: "${slug}" allowed`);
    } catch (error) {
      console.log(`❌ FAIL: "${slug}" was blocked!`);
      console.log(`   Reason: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  });

  console.log('\n✅ Slug Validation Tests Complete\n');
}
