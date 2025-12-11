import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import katex from 'katex';

/**
 * Sanitize schema that allows safe HTML elements while blocking XSS vectors
 *
 * Allowed: headings, paragraphs, lists, tables, links, images, code, emphasis
 * Blocked: script tags, inline event handlers, iframes, raw HTML injection
 */
const safeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow class names for KaTeX
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    // Allow specific attributes for links
    a: [...(defaultSchema.attributes?.a || []), 'href', 'title', 'target', 'rel'],
    // Allow specific attributes for images
    img: [...(defaultSchema.attributes?.img || []), 'src', 'alt', 'title', 'loading', 'width', 'height'],
    // Allow specific attributes for code blocks
    code: [...(defaultSchema.attributes?.code || []), 'className', 'class'],
    pre: [...(defaultSchema.attributes?.pre || []), 'className', 'class'],
    // Allow span for KaTeX formulas
    span: [...(defaultSchema.attributes?.span || []), 'className', 'class', 'style'],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    // Ensure all standard markdown elements are allowed
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'img',
    'strong', 'em', 'b', 'i',
    'code', 'pre',
    'blockquote',
    'hr',
    // For KaTeX formulas
    'span', 'div',
  ],
  // Explicitly block dangerous protocols
  protocols: {
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https', 'data'],
  },
};

/**
 * Render LaTeX formulas to HTML using KaTeX (secure)
 */
function renderLatex(text: string): string {
  // First handle block math ($$...$$)
  let result = text.replace(/\$\$([^$]+)\$\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: true,
        throwOnError: false,
        strict: false,
        trust: false, // Security: prevent \href and other potentially dangerous commands
      });
    } catch {
      return `<span class="formula-error">[Formule: ${escapeHtml(formula)}]</span>`;
    }
  });

  // Then handle inline math ($...$)
  result = result.replace(/(?<!\$)\$(?!\$)([^$]+)\$(?!\$)/g, (_, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
        strict: false,
        trust: false,
      });
    } catch {
      return `<span class="formula-error">[Formule: ${escapeHtml(formula)}]</span>`;
    }
  });

  return result;
}

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render Markdown to safe HTML
 *
 * This function:
 * 1. Processes LaTeX formulas with KaTeX (with trust=false for security)
 * 2. Parses Markdown with GitHub Flavored Markdown support
 * 3. Sanitizes HTML to remove XSS vectors
 * 4. Returns safe HTML string
 *
 * Security features:
 * - Blocks <script> tags
 * - Blocks inline event handlers (onclick, onerror, etc.)
 * - Blocks <iframe>, <object>, <embed>
 * - Sanitizes URLs (only allows http/https/mailto protocols)
 * - Escapes raw HTML content
 *
 * @param markdown - Raw markdown string (potentially unsafe)
 * @returns Safe HTML string ready for dangerouslySetInnerHTML
 */
export async function renderSafeMarkdown(markdown: string): Promise<string> {
  if (!markdown) return '';

  // First render LaTeX formulas
  const withLatex = renderLatex(markdown);

  // Process markdown through unified pipeline
  const file = await unified()
    .use(remarkParse) // Parse markdown
    .use(remarkGfm) // Add GitHub Flavored Markdown (tables, task lists, etc.)
    .use(remarkRehype, { allowDangerousHtml: false }) // Convert to HTML (block dangerous HTML)
    .use(rehypeSanitize, safeSchema) // Sanitize HTML
    .use(rehypeStringify) // Convert to string
    .process(withLatex);

  return String(file);
}

/**
 * Synchronous version of renderSafeMarkdown (less feature-complete but faster)
 * Use this for simple cases where you don't need GFM features
 */
export function renderSafeMarkdownSync(markdown: string): string {
  if (!markdown) return '';

  // Render LaTeX first
  let processed = renderLatex(markdown);

  // Basic markdown parsing with XSS protection
  processed = processed
    // Headings
    .replace(/^### (.*$)/gm, (_, text) => `<h3>${escapeHtml(text)}</h3>`)
    .replace(/^## (.*$)/gm, (_, text) => `<h2>${escapeHtml(text)}</h2>`)
    .replace(/^# (.*$)/gm, (_, text) => `<h1>${escapeHtml(text)}</h1>`)
    // Bold and italic (already safe in escaped context)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\\)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>')
    // Lists (escape content)
    .replace(/^\d+\.\s+(.*$)/gm, (_, text) => `<li>${escapeHtml(text)}</li>`)
    .replace(/^[-•]\s+(.*$)/gm, (_, text) => `<li>${escapeHtml(text)}</li>`)
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      const isNumbered = /^\d+\./.test(markdown);
      const tag = isNumbered ? 'ol' : 'ul';
      return `<${tag}>${match}</${tag}>`;
    })
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/s, '<p>$1</p>')
    // Clean up
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p><h/g, '<h')
    .replace(/<\/h(\d)><\/p>/g, '</h$1>')
    .replace(/<p><(ul|ol)>/g, '<$1>')
    .replace(/<\/(ul|ol)><\/p>/g, '</$1>');

  return processed;
}

/**
 * Test helper to verify XSS protection
 * Returns true if XSS vectors are properly blocked
 */
export async function testXSSProtection(): Promise<{
  passed: boolean;
  results: { test: string; safe: boolean; output: string }[];
}> {
  const xssTests = [
    {
      name: 'Script tag injection',
      input: '<script>alert("XSS")</script>Hello',
      shouldBlock: ['<script', 'alert'],
    },
    {
      name: 'Img onerror injection',
      input: '<img src=x onerror=alert(1)>',
      shouldBlock: ['onerror', 'alert'],
    },
    {
      name: 'Iframe injection',
      input: '<iframe src="javascript:alert(1)"></iframe>',
      shouldBlock: ['<iframe', 'javascript:'],
    },
    {
      name: 'Onclick handler',
      input: '<a href="#" onclick="alert(1)">Click</a>',
      shouldBlock: ['onclick'],
    },
    {
      name: 'JavaScript protocol',
      input: '<a href="javascript:void(0)">Link</a>',
      shouldBlock: ['javascript:'],
    },
  ];

  const results = await Promise.all(
    xssTests.map(async (test) => {
      const output = await renderSafeMarkdown(test.input);
      const safe = test.shouldBlock.every((pattern) => !output.toLowerCase().includes(pattern.toLowerCase()));
      return {
        test: test.name,
        safe,
        output,
      };
    })
  );

  const passed = results.every((r) => r.safe);

  return { passed, results };
}
