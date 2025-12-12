/**
 * Client-side HTML to Markdown conversion
 *
 * This module handles conversion of HTML tags to Markdown equivalents.
 * Used to sanitize AI output that may contain HTML instead of Markdown.
 *
 * This runs on the CLIENT after receiving the full streaming response,
 * ensuring complete tags are processed (unlike server-side chunk processing).
 */

/**
 * Decode basic HTML entities
 */
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
 * Convert HTML tags to Markdown equivalents
 *
 * Handles:
 * - Bold: <strong>, <b> → **text**
 * - Italic: <em>, <i> → *text*
 * - Line breaks: <br> → \n
 * - Paragraphs: <p> → newlines
 * - Headers: <h1-h3> → # headers
 * - Lists: <li> → - items
 *
 * Uses the 's' flag for multiline matching to handle tags spanning multiple lines.
 */
export function sanitizeHtmlToMarkdown(text: string): string {
  if (!text) return text;

  // First decode HTML entities
  const decoded = decodeBasicEntities(text);

  return decoded
    // Bold: <strong>, <b> → **text** (s flag for multiline support)
    .replace(/<strong>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<b>(.*?)<\/b>/gis, '**$1**')
    // Italic: <em>, <i> → *text* (s flag for multiline support)
    .replace(/<em>(.*?)<\/em>/gis, '*$1*')
    .replace(/<i>(.*?)<\/i>/gis, '*$1*')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Paragraphs
    .replace(/<p>(.*?)<\/p>/gis, '$1\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p>/gi, '')
    // Headers (basic support)
    .replace(/<h1>(.*?)<\/h1>/gis, '# $1\n')
    .replace(/<h2>(.*?)<\/h2>/gis, '## $1\n')
    .replace(/<h3>(.*?)<\/h3>/gis, '### $1\n')
    .replace(/<h4>(.*?)<\/h4>/gis, '#### $1\n')
    // Lists
    .replace(/<li>(.*?)<\/li>/gis, '- $1\n')
    .replace(/<\/?[uo]l>/gi, '\n')
    // Clean up any remaining opening/closing tags that weren't matched
    // This handles incomplete or malformed tags
    .replace(/<\/?strong>/gi, '**')
    .replace(/<\/?b>/gi, '**')
    .replace(/<\/?em>/gi, '*')
    .replace(/<\/?i>/gi, '*');
}
