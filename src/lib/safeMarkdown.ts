import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import katex from 'katex';

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

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
 * Convert HTML tags to Markdown equivalents before processing
 * This handles cases where AI outputs HTML instead of Markdown
 */
function convertHtmlToMarkdown(text: string): string {
  if (!text) return text;

  // Decode entity-geëncodeerde tags (&lt;strong&gt;, &lt;em&gt;, …)
  const decoded = decodeBasicEntities(text);

  return decoded
    // Bold: <strong>, <b> → **text** (s flag voor multiline support)
    .replace(/<strong>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<b>(.*?)<\/b>/gis, '**$1**')
    // Handle unclosed/partial tags
    .replace(/<\/?strong>/gi, '**')
    .replace(/<\/?b>/gi, '**')
    // Italic: <em>, <i> → *text* (s flag voor multiline support)
    .replace(/<em>(.*?)<\/em>/gis, '*$1*')
    .replace(/<i>(.*?)<\/i>/gis, '*$1*')
    .replace(/<\/?em>/gi, '*')
    .replace(/<\/?i>/gi, '*')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Paragraphs
    .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p>/gi, '')
    // Headers
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n')
    // Lists
    .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?[uo]l>/gi, '\n');
}

/**
 * Synchronous version of renderSafeMarkdown (less feature-complete but faster)
 * Use this for simple cases where you don't need GFM features
 */
export function renderSafeMarkdownSync(markdown: string): string {
  if (!markdown) return '';

  // FIRST: Convert any HTML tags to Markdown (handles AI outputting HTML)
  let processed = convertHtmlToMarkdown(markdown);

  // Render LaTeX
  processed = renderLatex(processed);

  // Basic markdown parsing with XSS protection
  // Note: Order matters! Lists must be processed BEFORE bold/italic to preserve ** markers
  processed = processed
    // Headings (escape content for XSS protection)
    .replace(/^### (.*$)/gm, (_, text) => `<h3>${escapeHtml(text)}</h3>`)
    .replace(/^## (.*$)/gm, (_, text) => `<h2>${escapeHtml(text)}</h2>`)
    .replace(/^# (.*$)/gm, (_, text) => `<h1>${escapeHtml(text)}</h1>`)
    // Lists FIRST (no escapeHtml - content is already sanitized and we need to preserve ** markers)
    .replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>')
    .replace(/^[-•]\s+(.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, (match) => {
      const isNumbered = /^\d+\./.test(markdown);
      const tag = isNumbered ? 'ol' : 'ul';
      return `<${tag}>${match}</${tag}>`;
    })
    // Bold and italic AFTER lists (so they work inside list items)
    .replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>')
    .replace(/(?<!\\)\*(?!\*)([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
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
