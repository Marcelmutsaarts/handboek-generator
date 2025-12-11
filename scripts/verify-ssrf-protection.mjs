#!/usr/bin/env node

/**
 * Quick SSRF Protection Verification Script
 *
 * Run this to quickly verify SSRF protections are working
 * Usage: node scripts/verify-ssrf-protection.mjs
 */

console.log('🔒 SSRF Protection Quick Verification\n');
console.log('This script tests the core URL safety functions.\n');

// Import the URL safety module
const { isPrivateIp } = await import('../src/lib/urlSafety.ts');

const tests = [
  // Should block (return true)
  { ip: '127.0.0.1', expected: true, name: 'Loopback 127.0.0.1' },
  { ip: 'localhost', expected: true, name: 'localhost' },
  { ip: '10.0.0.1', expected: true, name: 'Private 10.x' },
  { ip: '192.168.1.1', expected: true, name: 'Private 192.168.x' },
  { ip: '172.16.0.1', expected: true, name: 'Private 172.16.x' },
  { ip: '169.254.169.254', expected: true, name: 'AWS metadata' },
  { ip: '::1', expected: true, name: 'IPv6 loopback' },
  { ip: 'fe80::1', expected: true, name: 'IPv6 link-local' },

  // Should allow (return false)
  { ip: '8.8.8.8', expected: false, name: 'Google DNS' },
  { ip: '1.1.1.1', expected: false, name: 'Cloudflare DNS' },
];

let passed = 0;
let failed = 0;

console.log('Testing isPrivateIp() function:\n');

for (const test of tests) {
  const result = isPrivateIp(test.ip);
  const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
  const expectedStr = test.expected ? 'BLOCK' : 'ALLOW';
  const resultStr = result ? 'BLOCKED' : 'ALLOWED';

  console.log(`${status}: ${test.name} (${test.ip})`);
  console.log(`   Expected: ${expectedStr}, Got: ${resultStr}`);

  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed === 0) {
  console.log('✅ All core SSRF protection tests passed!');
  console.log('\nNext steps:');
  console.log('  1. Run the dev server: npm run dev');
  console.log('  2. Visit: http://localhost:3000/test-ssrf');
  console.log('  3. Click "Run Automated Tests"');
  console.log('  4. Verify all tests pass\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed! Review the implementation.\n');
  process.exit(1);
}
