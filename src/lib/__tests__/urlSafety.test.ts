/**
 * SSRF Protection Tests
 *
 * Verifies that URL safety utilities correctly block dangerous URLs
 * and allow safe ones.
 */

import { isPrivateIp, assertUrlIsSafe, safeFetch } from '../urlSafety';

describe('isPrivateIp', () => {
  describe('should block localhost variations', () => {
    it('blocks "localhost"', () => {
      expect(isPrivateIp('localhost')).toBe(true);
    });

    it('blocks "*.localhost"', () => {
      expect(isPrivateIp('foo.localhost')).toBe(true);
      expect(isPrivateIp('api.localhost')).toBe(true);
    });

    it('blocks "::1" (IPv6 loopback)', () => {
      expect(isPrivateIp('::1')).toBe(true);
    });

    it('blocks "::" (IPv6 unspecified)', () => {
      expect(isPrivateIp('::')).toBe(true);
    });
  });

  describe('should block IPv4 loopback (127.0.0.0/8)', () => {
    it('blocks 127.0.0.1', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
    });

    it('blocks 127.0.0.2', () => {
      expect(isPrivateIp('127.0.0.2')).toBe(true);
    });

    it('blocks 127.255.255.255', () => {
      expect(isPrivateIp('127.255.255.255')).toBe(true);
    });
  });

  describe('should block private IPv4 ranges', () => {
    it('blocks 10.0.0.0/8', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.255.255.255')).toBe(true);
    });

    it('blocks 172.16.0.0/12', () => {
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
    });

    it('blocks 192.168.0.0/16', () => {
      expect(isPrivateIp('192.168.0.1')).toBe(true);
      expect(isPrivateIp('192.168.255.255')).toBe(true);
    });
  });

  describe('should block link-local addresses', () => {
    it('blocks 169.254.0.0/16 (IPv4 link-local)', () => {
      expect(isPrivateIp('169.254.1.1')).toBe(true);
      expect(isPrivateIp('169.254.169.254')).toBe(true); // AWS metadata
    });

    it('blocks fe80::/10 (IPv6 link-local)', () => {
      expect(isPrivateIp('fe80::1')).toBe(true);
    });
  });

  describe('should block private IPv6 ranges', () => {
    it('blocks fc00::/7 (unique local)', () => {
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fd00::1')).toBe(true);
    });

    it('blocks ff00::/8 (multicast)', () => {
      expect(isPrivateIp('ff02::1')).toBe(true);
    });
  });

  describe('should block special addresses', () => {
    it('blocks 0.0.0.0', () => {
      expect(isPrivateIp('0.0.0.0')).toBe(true);
    });

    it('blocks 255.255.255.255 (broadcast)', () => {
      expect(isPrivateIp('255.255.255.255')).toBe(true);
    });
  });

  describe('should allow public IPs', () => {
    it('allows 8.8.8.8 (Google DNS)', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
    });

    it('allows 1.1.1.1 (Cloudflare DNS)', () => {
      expect(isPrivateIp('1.1.1.1')).toBe(false);
    });

    it('allows 151.101.1.69 (Fastly)', () => {
      expect(isPrivateIp('151.101.1.69')).toBe(false);
    });
  });

  describe('should handle invalid IPs safely', () => {
    it('treats invalid IPs as private (fail-closed)', () => {
      expect(isPrivateIp('999.999.999.999')).toBe(true);
      expect(isPrivateIp('not-an-ip')).toBe(true);
    });
  });
});

describe('assertUrlIsSafe', () => {
  describe('should reject non-HTTPS URLs', () => {
    it('rejects HTTP URLs', async () => {
      await expect(assertUrlIsSafe('http://example.com')).rejects.toThrow('Only HTTPS URLs are allowed');
    });

    it('rejects FTP URLs', async () => {
      await expect(assertUrlIsSafe('ftp://example.com')).rejects.toThrow('Only HTTPS URLs are allowed');
    });

    it('rejects file:// URLs', async () => {
      await expect(assertUrlIsSafe('file:///etc/passwd')).rejects.toThrow('Only HTTPS URLs are allowed');
    });
  });

  describe('should reject URLs with credentials', () => {
    it('rejects URL with username', async () => {
      await expect(assertUrlIsSafe('https://user@example.com')).rejects.toThrow('credentials are not allowed');
    });

    it('rejects URL with username and password', async () => {
      await expect(assertUrlIsSafe('https://user:pass@example.com')).rejects.toThrow('credentials are not allowed');
    });
  });

  describe('should reject overly long URLs', () => {
    it('rejects URLs longer than 2048 chars', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2048);
      await expect(assertUrlIsSafe(longUrl)).rejects.toThrow('URL too long');
    });

    it('allows URLs up to 2048 chars', async () => {
      const okUrl = 'https://example.com/' + 'a'.repeat(2000);
      // This might fail on DNS resolution, but should pass length check
      // We're just testing it doesn't fail on length
      try {
        await assertUrlIsSafe(okUrl);
      } catch (error) {
        // If it fails, it should be DNS-related, not length
        expect(error).not.toMatch(/URL too long/);
      }
    });
  });

  describe('should reject private IP literals', () => {
    it('rejects https://127.0.0.1', async () => {
      await expect(assertUrlIsSafe('https://127.0.0.1')).rejects.toThrow('Private/internal IP');
    });

    it('rejects https://localhost', async () => {
      await expect(assertUrlIsSafe('https://localhost')).rejects.toThrow('Private/internal IP');
    });

    it('rejects https://10.0.0.1', async () => {
      await expect(assertUrlIsSafe('https://10.0.0.1')).rejects.toThrow('Private/internal IP');
    });

    it('rejects https://192.168.1.1', async () => {
      await expect(assertUrlIsSafe('https://192.168.1.1')).rejects.toThrow('Private/internal IP');
    });

    it('rejects https://169.254.169.254 (AWS metadata)', async () => {
      await expect(assertUrlIsSafe('https://169.254.169.254')).rejects.toThrow('Private/internal IP');
    });

    it('rejects https://[::1] (IPv6 loopback)', async () => {
      await expect(assertUrlIsSafe('https://[::1]')).rejects.toThrow('Private/internal IP');
    });
  });

  describe('should handle invalid URLs', () => {
    it('rejects malformed URLs', async () => {
      await expect(assertUrlIsSafe('not a url')).rejects.toThrow('Invalid URL format');
    });

    it('rejects empty URLs', async () => {
      await expect(assertUrlIsSafe('')).rejects.toThrow('Invalid URL format');
    });
  });

  // Note: DNS resolution tests are harder to write reliably
  // In a real environment, you'd use mocks or test against known DNS records
  describe('DNS resolution (integration tests)', () => {
    it('allows public domains (example.com)', async () => {
      // This is an integration test that requires network access
      // Skip in CI/offline environments
      if (process.env.CI || process.env.SKIP_NETWORK_TESTS) {
        return;
      }

      // example.com should resolve to public IPs
      await expect(assertUrlIsSafe('https://example.com')).resolves.not.toThrow();
    }, 10000); // 10s timeout for network request
  });
});

describe('safeFetch', () => {
  describe('should handle timeouts', () => {
    it('times out after specified duration', async () => {
      // Using a non-routable IP to force timeout (192.0.2.0/24 is TEST-NET)
      const result = await safeFetch('https://192.0.2.1', { timeout: 100 });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/timeout|Private/i);
    }, 5000);
  });

  describe('should validate URLs', () => {
    it('rejects private IPs', async () => {
      const result = await safeFetch('https://127.0.0.1');
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/Private/i);
    });

    it('rejects non-HTTPS', async () => {
      const result = await safeFetch('http://example.com');
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/HTTPS/i);
    });
  });

  // Integration test with real URL (skip in CI)
  it('fetches public HTTPS URLs successfully', async () => {
    if (process.env.CI || process.env.SKIP_NETWORK_TESTS) {
      return;
    }

    const result = await safeFetch('https://example.com', { timeout: 5000 });
    expect(result.status).toBeGreaterThan(0);
  }, 10000);
});

/**
 * Manual test runner for quick verification
 */
export async function runManualSSRFTests(): Promise<void> {
  console.log('🔒 Running SSRF Protection Tests...\n');

  const dangerousUrls = [
    'https://127.0.0.1',
    'https://localhost',
    'https://10.0.0.1',
    'https://192.168.1.1',
    'https://169.254.169.254',
    'https://[::1]',
    'http://example.com',
    'https://user:pass@example.com',
  ];

  const safeUrls = ['https://example.com', 'https://wikipedia.org'];

  console.log('Testing DANGEROUS URLs (should be blocked):\n');
  for (const url of dangerousUrls) {
    try {
      await assertUrlIsSafe(url);
      console.log(`❌ FAIL: ${url} was NOT blocked!`);
    } catch (error) {
      console.log(`✅ PASS: ${url} blocked`);
      console.log(`   Reason: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  console.log('\n\nTesting SAFE URLs (should be allowed):\n');
  for (const url of safeUrls) {
    try {
      await assertUrlIsSafe(url);
      console.log(`✅ PASS: ${url} allowed`);
    } catch (error) {
      console.log(`❌ FAIL: ${url} was blocked!`);
      console.log(`   Reason: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  console.log('\n✅ SSRF Protection Tests Complete\n');
}
