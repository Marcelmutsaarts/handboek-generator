import { renderSafeMarkdown, testXSSProtection } from '../safeMarkdown';

/**
 * XSS Protection Tests
 *
 * Run these tests to verify that dangerous content is properly sanitized
 */

describe('XSS Protection Tests', () => {
  it('should block script tags', async () => {
    const input = '<script>alert("XSS")</script>Hello World';
    const output = await renderSafeMarkdown(input);

    // Should not contain script tag or alert
    expect(output.toLowerCase()).not.toContain('<script');
    expect(output.toLowerCase()).not.toContain('alert');
    expect(output).toContain('Hello World');
  });

  it('should block img onerror injections', async () => {
    const input = '<img src=x onerror=alert(1)>';
    const output = await renderSafeMarkdown(input);

    // Should not contain onerror or alert
    expect(output.toLowerCase()).not.toContain('onerror');
    expect(output.toLowerCase()).not.toContain('alert');
  });

  it('should block iframe injections', async () => {
    const input = '<iframe src="javascript:alert(1)"></iframe>';
    const output = await renderSafeMarkdown(input);

    // Should not contain iframe or javascript protocol
    expect(output.toLowerCase()).not.toContain('<iframe');
    expect(output.toLowerCase()).not.toContain('javascript:');
  });

  it('should block onclick handlers', async () => {
    const input = '<a href="#" onclick="alert(1)">Click me</a>';
    const output = await renderSafeMarkdown(input);

    // Should not contain onclick
    expect(output.toLowerCase()).not.toContain('onclick');
  });

  it('should block javascript: protocol in links', async () => {
    const input = '<a href="javascript:void(0)">Link</a>';
    const output = await renderSafeMarkdown(input);

    // Should not contain javascript protocol
    expect(output.toLowerCase()).not.toContain('javascript:');
  });

  it('should allow safe markdown features', async () => {
    const input = `# Heading 1
## Heading 2
### Heading 3

**Bold text** and *italic text*

- List item 1
- List item 2

1. Numbered item 1
2. Numbered item 2

[Safe link](https://example.com)

![Safe image](https://example.com/image.jpg)

Inline code: \`const x = 5;\`

\`\`\`
code block
\`\`\`

> Blockquote`;

    const output = await renderSafeMarkdown(input);

    // Should contain all safe HTML elements
    expect(output).toContain('<h1');
    expect(output).toContain('<h2');
    expect(output).toContain('<h3');
    expect(output).toContain('<strong>');
    expect(output).toContain('<em>');
    expect(output).toContain('<ul');
    expect(output).toContain('<ol');
    expect(output).toContain('<a ');
    expect(output).toContain('href="https://example.com"');
    expect(output).toContain('<img ');
    expect(output).toContain('<code');
    expect(output).toContain('<blockquote');
  });

  it('should allow LaTeX formulas with trust=false', async () => {
    const input = 'Inline formula: $E = mc^2$ and block formula:\n\n$$\\frac{a}{b}$$';
    const output = await renderSafeMarkdown(input);

    // Should contain KaTeX rendered output (spans with katex classes)
    expect(output).toContain('katex');
    // Should not contain the raw LaTeX delimiters
    expect(output).not.toContain('$E =');
  });

  it('should run comprehensive XSS tests', async () => {
    const result = await testXSSProtection();

    // All tests should pass
    expect(result.passed).toBe(true);

    // Print results for manual verification
    console.log('\n=== XSS Protection Test Results ===');
    result.results.forEach((r) => {
      console.log(`\n${r.safe ? '✅' : '❌'} ${r.test}`);
      console.log(`   Output: ${r.output.substring(0, 100)}...`);
    });
    console.log('\n===================================\n');
  });
});

// Manual test runner (can be called directly)
export async function runManualXSSTests() {
  console.log('🔒 Running XSS Protection Tests...\n');

  const tests = [
    { name: 'Script injection', input: '<script>alert("XSS")</script>Hello' },
    { name: 'Img onerror', input: '<img src=x onerror=alert(1)>' },
    { name: 'Iframe injection', input: '<iframe src="javascript:alert(1)"></iframe>' },
    { name: 'Onclick handler', input: '<a href="#" onclick="alert(1)">Click</a>' },
    { name: 'JavaScript protocol', input: '<a href="javascript:void(0)">Link</a>' },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const output = await renderSafeMarkdown(test.input);
    const isSafe =
      !output.toLowerCase().includes('<script') &&
      !output.toLowerCase().includes('alert') &&
      !output.toLowerCase().includes('onerror') &&
      !output.toLowerCase().includes('onclick') &&
      !output.toLowerCase().includes('javascript:') &&
      !output.toLowerCase().includes('<iframe');

    if (isSafe) {
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Output: ${output}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  return { passed, failed, total: tests.length };
}
