/**
 * XSS Protection Verification Script
 *
 * Run this script to verify that XSS protection is working correctly:
 * node scripts/test-xss-protection.mjs
 */

import { renderSafeMarkdown, testXSSProtection } from '../src/lib/safeMarkdown.ts';

console.log('🔒 XSS Protection Verification\n');
console.log('Testing dangerous input patterns...\n');

// Run the built-in comprehensive tests
const result = await testXSSProtection();

console.log('=== Test Results ===\n');

result.results.forEach((test) => {
  const status = test.safe ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${test.test}`);
  if (!test.safe) {
    console.log(`  ⚠️  Dangerous content detected in output:`);
    console.log(`  ${test.output.substring(0, 100)}...`);
  }
});

console.log(`\n${'='.repeat(50)}`);
console.log(`Overall: ${result.passed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log(`${'='.repeat(50)}\n`);

// Additional feature tests
console.log('\n📝 Testing safe markdown features...\n');

const safeMarkdown = `# Test Document

## Safe Features

**Bold text** and *italic text* work correctly.

- Bullet lists
- Work properly

1. Numbered lists
2. Also work

[Links](https://example.com) are allowed.

![Images](https://example.com/image.jpg "Alt text") are safe.

Inline code: \`const x = 5;\`

\`\`\`javascript
code blocks
\`\`\`

> Blockquotes work

LaTeX formulas: $E = mc^2$ and $$\\frac{a}{b}$$
`;

const safeOutput = await renderSafeMarkdown(safeMarkdown);

const hasHeadings = safeOutput.includes('<h1') && safeOutput.includes('<h2');
const hasFormatting = safeOutput.includes('<strong>') && safeOutput.includes('<em>');
const hasLists = safeOutput.includes('<ul') && safeOutput.includes('<ol');
const hasLinks = safeOutput.includes('<a ') && safeOutput.includes('href=');
const hasImages = safeOutput.includes('<img ');
const hasCode = safeOutput.includes('<code');
const hasBlockquotes = safeOutput.includes('<blockquote');
const hasLatex = safeOutput.includes('katex');

const features = [
  { name: 'Headings', status: hasHeadings },
  { name: 'Text formatting (bold/italic)', status: hasFormatting },
  { name: 'Lists (bullet/numbered)', status: hasLists },
  { name: 'Links', status: hasLinks },
  { name: 'Images', status: hasImages },
  { name: 'Code blocks', status: hasCode },
  { name: 'Blockquotes', status: hasBlockquotes },
  { name: 'LaTeX formulas', status: hasLatex },
];

features.forEach(({ name, status }) => {
  console.log(`  ${status ? '✅' : '❌'} ${name}`);
});

const allFeaturesWork = features.every((f) => f.status);

console.log(`\n${'='.repeat(50)}`);
console.log(`Features: ${allFeaturesWork ? '✅ ALL WORKING' : '❌ SOME ISSUES'}`);
console.log(`${'='.repeat(50)}\n`);

// Final summary
if (result.passed && allFeaturesWork) {
  console.log('🎉 SUCCESS! XSS protection is working correctly.');
  console.log('   - All dangerous patterns are blocked');
  console.log('   - All safe markdown features work as expected');
  process.exit(0);
} else {
  console.log('⚠️  WARNING! Some tests failed.');
  console.log('   Please review the output above.');
  process.exit(1);
}
