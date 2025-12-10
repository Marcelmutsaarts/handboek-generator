import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, PageBreak, AlignmentType, VerticalAlign, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';
import katex from 'katex';
import { Handboek, Hoofdstuk, Afbeelding } from '@/types';

// Render LaTeX to HTML using KaTeX
function renderLatex(text: string): string {
  // First handle block math ($$...$$)
  let result = text.replace(/\$\$([^$]+)\$\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: true,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span class="formula-error">[Formule: ${formula}]</span>`;
    }
  });

  // Then handle inline math ($...$)
  result = result.replace(/(?<!\$)\$(?!\$)([^$]+)\$(?!\$)/g, (_, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span class="formula-error">[Formule: ${formula}]</span>`;
    }
  });

  return result;
}

// Convert LaTeX to readable Unicode text for Word export
function latexToUnicode(text: string): string {
  const replacements: [RegExp, string][] = [
    [/\\times/g, '×'],
    [/\\cdot/g, '·'],
    [/\\div/g, '÷'],
    [/\\pm/g, '±'],
    [/\\leq/g, '≤'],
    [/\\geq/g, '≥'],
    [/\\neq/g, '≠'],
    [/\\approx/g, '≈'],
    [/\\infty/g, '∞'],
    [/\\sqrt\{([^}]+)\}/g, '√($1)'],
    [/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)'],
    [/\\sum/g, 'Σ'],
    [/\\prod/g, 'Π'],
    [/\\int/g, '∫'],
    [/\\alpha/g, 'α'],
    [/\\beta/g, 'β'],
    [/\\gamma/g, 'γ'],
    [/\\delta/g, 'δ'],
    [/\\epsilon/g, 'ε'],
    [/\\theta/g, 'θ'],
    [/\\lambda/g, 'λ'],
    [/\\mu/g, 'μ'],
    [/\\pi/g, 'π'],
    [/\\sigma/g, 'σ'],
    [/\\omega/g, 'ω'],
    [/\\Delta/g, 'Δ'],
    [/\\Sigma/g, 'Σ'],
    [/\\Omega/g, 'Ω'],
    [/\^2/g, '²'],
    [/\^3/g, '³'],
    [/\^n/g, 'ⁿ'],
    [/\^{([^}]+)}/g, '^($1)'],
    [/_\{([^}]+)\}/g, '_($1)'],
    [/\\left/g, ''],
    [/\\right/g, ''],
    [/\\\\/g, ''],
  ];

  let result = text;
  // Remove $...$ and $$...$$ delimiters
  result = result.replace(/\$\$([^$]+)\$\$/g, '$1');
  result = result.replace(/\$([^$]+)\$/g, '$1');

  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result.trim();
}

// Helper to convert image URL to buffer
export const fetchImageAsBuffer = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    // For base64 data URLs
    if (url.startsWith('data:')) {
      const base64 = url.split(',')[1];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
    // For external URLs
    const response = await fetch(url);
    return await response.arrayBuffer();
  } catch (err) {
    console.error('Error fetching image:', err);
    return null;
  }
};

// Helper function to parse bold, italic and LaTeX in text for Word
export const parseInlineFormatting = (text: string): TextRun[] => {
  // First convert LaTeX to Unicode for Word
  const processedText = latexToUnicode(text);

  const runs: TextRun[] = [];
  let remaining = processedText;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/\*(.+?)\*/);

    if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
      if (boldMatch.index! > 0) {
        runs.push(new TextRun({ text: remaining.slice(0, boldMatch.index) }));
      }
      runs.push(new TextRun({ text: boldMatch[1], bold: true }));
      remaining = remaining.slice(boldMatch.index! + boldMatch[0].length);
    } else if (italicMatch) {
      if (italicMatch.index! > 0) {
        runs.push(new TextRun({ text: remaining.slice(0, italicMatch.index) }));
      }
      runs.push(new TextRun({ text: italicMatch[1], italics: true }));
      remaining = remaining.slice(italicMatch.index! + italicMatch[0].length);
    } else {
      runs.push(new TextRun({ text: remaining }));
      break;
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text: processedText })];
};

// Parse markdown to HTML (with LaTeX support)
export const parseMarkdown = (text: string): string => {
  if (!text) return '';

  // First render LaTeX formulas
  let processed = renderLatex(text);

  return processed
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\\)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>')
    .replace(/^[-•]\s+(.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      const isNumbered = text.includes('1.');
      const tag = isNumbered ? 'ol' : 'ul';
      return `<${tag}>${match}</${tag}>`;
    })
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/s, '<p>$1</p>')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p><h/g, '<h')
    .replace(/<\/h(\d)><\/p>/g, '</h$1>')
    .replace(/<p><(ul|ol)>/g, '<$1>')
    .replace(/<\/(ul|ol)><\/p>/g, '</$1>');
};

interface ChapterImage {
  url: string;
  alt: string;
  caption?: string;
  photographer?: string;
  isAiGenerated?: boolean;
}

// Process content with images for Word export
export const processContentForWord = async (
  content: string,
  images: ChapterImage[]
): Promise<Paragraph[]> => {
  const parts = content.split(/\[AFBEELDING:\s*([^\]]+)\]/g);
  let imageIndex = 0;
  const docElements: Paragraph[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const textPart = parts[i];
      const lines = textPart.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('# ')) {
          docElements.push(
            new Paragraph({
              text: trimmedLine.slice(2),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            })
          );
        } else if (trimmedLine.startsWith('## ')) {
          docElements.push(
            new Paragraph({
              text: trimmedLine.slice(3),
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
            })
          );
        } else if (trimmedLine.startsWith('### ')) {
          docElements.push(
            new Paragraph({
              text: trimmedLine.slice(4),
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
            })
          );
        } else if (/^\d+\.\s/.test(trimmedLine)) {
          const text = trimmedLine.replace(/^\d+\.\s/, '');
          docElements.push(
            new Paragraph({
              children: parseInlineFormatting(text),
              numbering: { reference: 'numbered-list', level: 0 },
              spacing: { before: 100, after: 100 },
            })
          );
        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ') || trimmedLine.startsWith('* ')) {
          const text = trimmedLine.slice(2);
          docElements.push(
            new Paragraph({
              children: parseInlineFormatting(text),
              bullet: { level: 0 },
              spacing: { before: 100, after: 100 },
            })
          );
        } else {
          docElements.push(
            new Paragraph({
              children: parseInlineFormatting(trimmedLine),
              spacing: { before: 100, after: 100 },
            })
          );
        }
      }
    } else {
      const image = images[imageIndex];
      imageIndex++;

      if (image) {
        const imageBuffer = await fetchImageAsBuffer(image.url);
        if (imageBuffer) {
          docElements.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: { width: 500, height: 280 },
                  type: 'png',
                }),
              ],
              spacing: { before: 200, after: 100 },
            })
          );

          // Add image caption if available
          if (image.caption) {
            docElements.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: image.caption,
                    size: 22,
                    italics: true,
                  }),
                ],
                spacing: { before: 50, after: 50 },
              })
            );
          }

          // Add source caption
          const sourceCaption = image.isAiGenerated
            ? 'AI-gegenereerde afbeelding via Gemini'
            : `Foto door ${image.photographer} via Pexels`;
          docElements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: sourceCaption,
                  size: 18,
                  italics: true,
                  color: '666666',
                }),
              ],
              spacing: { after: 200 },
            })
          );
        }
      }
    }
  }

  return docElements;
};

const NIVEAU_LABELS: Record<string, string> = {
  po_onder: 'Basisschool onderbouw',
  po_boven: 'Basisschool bovenbouw',
  vmbo: 'VMBO',
  havo: 'HAVO',
  vwo: 'VWO',
  mbo: 'MBO',
  hbo: 'HBO',
  uni: 'Universiteit',
};

// Export complete handboek as Word document
export const exportHandboekAsWord = async (
  handboek: Handboek,
  hoofdstukken: Hoofdstuk[],
  afbeeldingenPerHoofdstuk: Record<string, Afbeelding[]>
): Promise<void> => {
  const coverElements: Paragraph[] = [];
  const contentElements: Paragraph[] = [];

  // Cover page - full page with image as background
  if (handboek.cover_url) {
    const coverBuffer = await fetchImageAsBuffer(handboek.cover_url);
    if (coverBuffer) {
      // Full-page cover image (A4 size approximately 595x842 points, we use larger for quality)
      coverElements.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: coverBuffer,
              transformation: { width: 595, height: 842 },
              type: 'png',
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      );

      // Title overlay on cover
      coverElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: handboek.titel,
              bold: true,
              size: 72,
              color: 'FFFFFF',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        })
      );

      // Subtitle/description on cover
      if (handboek.beschrijving) {
        coverElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: handboek.beschrijving,
                size: 32,
                color: 'FFFFFF',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );
      }

      // Niveau info on cover
      coverElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Leerjaar ${handboek.leerjaar}`,
              size: 28,
              color: 'FFFFFF',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        })
      );

      if (handboek.context) {
        coverElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: handboek.context,
                size: 24,
                color: 'FFFFFF',
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
          })
        );
      }
    }
  } else {
    // Fallback title page without cover image
    coverElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: handboek.titel,
            bold: true,
            size: 56,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 2000, after: 400 },
      })
    );

    if (handboek.beschrijving) {
      coverElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: handboek.beschrijving,
              size: 28,
              color: '666666',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );
    }

    coverElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Leerjaar ${handboek.leerjaar}`,
            size: 24,
            color: '888888',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    if (handboek.context) {
      coverElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Context: ${handboek.context}`,
              size: 24,
              color: '888888',
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );
    }
  }

  // Table of contents (starts on new page)
  contentElements.push(
    new Paragraph({
      text: 'Inhoudsopgave',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 300 },
    })
  );

  hoofdstukken.forEach((hoofdstuk, index) => {
    contentElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${index + 1}. ${hoofdstuk.titel}`,
            size: 24,
          }),
        ],
        spacing: { before: 100, after: 100 },
      })
    );
  });

  // Chapters
  for (let i = 0; i < hoofdstukken.length; i++) {
    const hoofdstuk = hoofdstukken[i];
    const afbeeldingen = afbeeldingenPerHoofdstuk[hoofdstuk.id] || [];

    // Page break before each chapter
    contentElements.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    // Chapter number header
    contentElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Hoofdstuk ${i + 1}`,
            size: 20,
            color: '888888',
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    // Convert afbeeldingen to ChapterImage format
    const chapterImages: ChapterImage[] = afbeeldingen.map((afb) => ({
      url: afb.url,
      alt: afb.alt || '',
      caption: afb.caption || undefined,
      photographer: afb.photographer || undefined,
      isAiGenerated: afb.is_ai_generated,
    }));

    // Process chapter content
    const chapterElements = await processContentForWord(hoofdstuk.content, chapterImages);
    contentElements.push(...chapterElements);
  }

  // Create document with separate sections for cover and content
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'numbered-list',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: 'start',
            },
          ],
        },
      ],
    },
    sections: [
      // Cover page section (no margins for full-page cover)
      {
        properties: handboek.cover_url ? {
          page: {
            margin: {
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            },
          },
        } : {},
        children: coverElements,
      },
      // Content section with normal margins
      {
        children: contentElements,
      },
    ],
  });

  // Generate and download
  const buffer = await Packer.toBlob(doc);
  const filename = `${handboek.titel.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.docx`;
  saveAs(buffer, filename);
};

// Generate static HTML for public sharing (returns HTML string)
// imageUrlMap: maps original base64/URLs to new Storage URLs
export const generatePublicHTML = (
  handboek: Handboek,
  hoofdstukken: Hoofdstuk[],
  afbeeldingenPerHoofdstuk: Record<string, Afbeelding[]>,
  imageUrlMap?: Record<string, string> // optional: maps original URLs to storage URLs
): string => {
  // Helper to get the right image URL
  const getImageUrl = (originalUrl: string): string => {
    if (imageUrlMap && imageUrlMap[originalUrl]) {
      return imageUrlMap[originalUrl];
    }
    return originalUrl;
  };
  let bodyContent = '';

  // Full-page cover or fallback title page
  if (handboek.cover_url) {
    bodyContent += `<div class="cover-page">
      <img src="${getImageUrl(handboek.cover_url)}" alt="Cover" class="cover-image">
    </div>
    <header class="cover-info">
      <h1 class="cover-title">${escapeHtml(handboek.titel)}</h1>
      ${handboek.beschrijving ? `<p class="cover-description">${escapeHtml(handboek.beschrijving)}</p>` : ''}
      <p class="cover-meta">
        ${NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Leerjaar ${handboek.leerjaar}
        ${handboek.context ? `<br><em>${escapeHtml(handboek.context)}</em>` : ''}
      </p>
    </header>`;
  } else {
    bodyContent += `<header class="title-page">
      <h1 class="title-main">${escapeHtml(handboek.titel)}</h1>
      ${handboek.beschrijving ? `<p class="title-description">${escapeHtml(handboek.beschrijving)}</p>` : ''}
      <p class="title-meta">
        ${NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Leerjaar ${handboek.leerjaar}
        ${handboek.context ? ` | ${escapeHtml(handboek.context)}` : ''}
      </p>
    </header>`;
  }

  // Content wrapper
  bodyContent += `<div class="content-wrapper">`;

  // Table of contents
  if (hoofdstukken.length > 0) {
    bodyContent += `<nav class="toc">
      <h2>Inhoudsopgave</h2>
      <ol>
        ${hoofdstukken.map((h, i) => `<li><a href="#hoofdstuk-${i + 1}">${escapeHtml(h.titel)}</a></li>`).join('')}
      </ol>
    </nav>`;
  }

  // Chapters
  hoofdstukken.forEach((hoofdstuk, index) => {
    const afbeeldingen = afbeeldingenPerHoofdstuk[hoofdstuk.id] || [];

    bodyContent += `<article id="hoofdstuk-${index + 1}" class="chapter">
      <p class="chapter-number">Hoofdstuk ${index + 1}</p>`;

    // Process content with images
    const parts = hoofdstuk.content.split(/\[AFBEELDING:\s*([^\]]+)\]/g);
    let imageIndex = 0;

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        bodyContent += parseMarkdown(parts[i]);
      } else {
        const image = afbeeldingen[imageIndex];
        imageIndex++;
        if (image) {
          const sourceCaption = image.is_ai_generated
            ? 'AI-gegenereerde afbeelding'
            : `Foto: ${image.photographer || 'Pexels'}`;
          bodyContent += `
<figure class="image-figure">
  <img src="${getImageUrl(image.url)}" alt="${escapeHtml(image.alt || '')}" loading="lazy">
  ${image.caption ? `<figcaption class="image-caption">${escapeHtml(image.caption)}</figcaption>` : ''}
  <figcaption class="image-source">${sourceCaption}</figcaption>
</figure>`;
        }
      }
    }

    bodyContent += '</article>';
  });

  // Close content wrapper
  bodyContent += `</div>`;

  // Footer
  bodyContent += `<footer class="page-footer">
    <p>Gemaakt met <a href="https://handboek-generator.vercel.app" target="_blank">Handboek Generator</a></p>
  </footer>`;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(handboek.titel)}</title>
  <meta name="description" content="${escapeHtml(handboek.beschrijving || `Handboek over ${handboek.titel}`)}">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      margin: 0;
      padding: 0;
      line-height: 1.8;
      color: #1a1a1a;
      background: #fff;
    }

    /* Cover page */
    .cover-page {
      width: 100%;
      display: flex;
      justify-content: center;
      background: #0f172a;
    }
    .cover-image {
      width: 100%;
      max-height: 80vh;
      object-fit: contain;
      display: block;
    }
    .cover-info {
      padding: 2rem;
      text-align: center;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
    }
    .cover-title {
      font-size: 2.5rem;
      font-weight: bold;
      margin: 0 0 1rem 0;
      color: #111827;
    }
    .cover-description {
      font-size: 1.1rem;
      margin: 0 0 1rem 0;
      color: #4b5563;
    }
    .cover-meta {
      font-size: 1rem;
      margin: 0;
      color: #6b7280;
    }

    /* Title page (no cover) */
    .title-page {
      min-height: 70vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 4rem 2rem;
      border-bottom: 2px solid #e5e7eb;
    }
    .title-main {
      font-size: 2.5rem;
      margin: 0 0 1rem 0;
      color: #111827;
    }
    .title-description {
      font-size: 1.1rem;
      color: #4b5563;
      margin: 0 0 1rem 0;
      max-width: 600px;
    }
    .title-meta {
      font-size: 0.9rem;
      color: #6b7280;
      margin: 0;
    }

    /* Content */
    .content-wrapper {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    /* TOC */
    .toc {
      padding: 1.5rem;
      background: #f8fafc;
      border-radius: 0.5rem;
      margin-bottom: 2rem;
    }
    .toc h2 {
      font-size: 1.25rem;
      margin: 0 0 1rem 0;
      border: none;
      padding: 0;
    }
    .toc ol {
      margin: 0;
      padding-left: 1.5rem;
    }
    .toc li {
      margin-bottom: 0.5rem;
    }
    .toc a {
      color: #2563eb;
      text-decoration: none;
    }
    .toc a:hover {
      text-decoration: underline;
    }

    /* Chapters */
    .chapter {
      margin-bottom: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #e5e7eb;
    }
    .chapter-number {
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #6b7280;
      margin: 0 0 0.5rem 0;
    }

    h1 { font-size: 1.75rem; margin: 0 0 1rem 0; color: #111827; }
    h2 { font-size: 1.375rem; margin: 2rem 0 0.75rem 0; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
    h3 { font-size: 1.125rem; margin: 1.5rem 0 0.5rem 0; color: #374151; }
    p { margin: 0 0 1rem 0; }
    ul, ol { margin: 1rem 0; padding-left: 2rem; }
    li { margin-bottom: 0.5rem; }
    strong { font-weight: 600; }
    em { font-style: italic; }

    /* Images */
    .image-figure {
      margin: 2rem 0;
    }
    .image-figure img {
      max-width: 100%;
      height: auto;
      border-radius: 0.5rem;
      display: block;
    }
    .image-caption {
      font-size: 0.875rem;
      color: #1e293b;
      font-style: italic;
      border-left: 2px solid #3b82f6;
      padding-left: 0.75rem;
      margin-top: 0.5rem;
    }
    .image-source {
      font-size: 0.75rem;
      color: #6b7280;
      margin-top: 0.25rem;
    }
    .image-placeholder .placeholder-box {
      background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
      border: 2px dashed #cbd5e1;
      border-radius: 0.5rem;
      padding: 3rem 2rem;
      text-align: center;
      color: #64748b;
    }
    .image-placeholder .placeholder-box p {
      margin: 0;
      font-style: italic;
    }

    /* Footer */
    .page-footer {
      text-align: center;
      padding: 2rem;
      border-top: 1px solid #e5e7eb;
      margin-top: 3rem;
      font-size: 0.875rem;
      color: #6b7280;
    }
    .page-footer a {
      color: #2563eb;
      text-decoration: none;
    }

    /* Print styles */
    @media print {
      .cover-page, .title-page {
        height: 100vh;
        page-break-after: always;
      }
      .toc { page-break-after: always; }
      .chapter { page-break-before: always; }
      .chapter:first-of-type { page-break-before: auto; }
      .image-figure { page-break-inside: avoid; }
      .page-footer { display: none; }
      a { color: inherit; text-decoration: none; }
    }

    /* Responsive */
    @media (max-width: 640px) {
      .cover-title { font-size: 1.75rem; }
      .title-main { font-size: 1.75rem; }
      .content-wrapper { padding: 1rem; }
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
};

// Helper to escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Export complete handboek as HTML
export const exportHandboekAsHTML = (
  handboek: Handboek,
  hoofdstukken: Hoofdstuk[],
  afbeeldingenPerHoofdstuk: Record<string, Afbeelding[]>
): void => {
  let bodyContent = '';

  // Full-page cover or fallback title page
  if (handboek.cover_url) {
    bodyContent += `<div class="cover-page">
      <img src="${handboek.cover_url}" alt="Cover" class="cover-image">
      <div class="cover-overlay">
        <h1 class="cover-title">${handboek.titel}</h1>
        ${handboek.beschrijving ? `<p class="cover-description">${handboek.beschrijving}</p>` : ''}
        <p class="cover-meta">
          ${NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Leerjaar ${handboek.leerjaar}
          ${handboek.context ? `<br><em>${handboek.context}</em>` : ''}
        </p>
      </div>
    </div>`;
  } else {
    bodyContent += `<header class="title-page">
      <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">${handboek.titel}</h1>
      ${handboek.beschrijving ? `<p style="color: #64748b; font-size: 1.1rem;">${handboek.beschrijving}</p>` : ''}
      <p style="color: #94a3b8; font-size: 0.9rem;">
        ${NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Leerjaar ${handboek.leerjaar}
        ${handboek.context ? ` | ${handboek.context}` : ''}
      </p>
    </header>`;
  }

  // Content wrapper for TOC and chapters
  bodyContent += `<div class="content-wrapper">`;

  // Table of contents
  bodyContent += `<nav>
    <h2 style="font-size: 1.25rem; margin-bottom: 1rem;">Inhoudsopgave</h2>
    <ol style="padding-left: 1.5rem;">
      ${hoofdstukken.map((h, i) => `<li style="margin-bottom: 0.5rem;"><a href="#hoofdstuk-${i + 1}" style="color: #3b82f6; text-decoration: none;">${h.titel}</a></li>`).join('')}
    </ol>
  </nav>`;

  // Chapters
  hoofdstukken.forEach((hoofdstuk, index) => {
    const afbeeldingen = afbeeldingenPerHoofdstuk[hoofdstuk.id] || [];

    bodyContent += `<article id="hoofdstuk-${index + 1}" style="margin-bottom: 3rem; padding-top: 2rem; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;">Hoofdstuk ${index + 1}</p>`;

    // Process content with images
    const parts = hoofdstuk.content.split(/\[AFBEELDING:\s*([^\]]+)\]/g);
    let imageIndex = 0;

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        bodyContent += parseMarkdown(parts[i]);
      } else {
        const image = afbeeldingen[imageIndex];
        imageIndex++;
        if (image) {
          const sourceCaption = image.is_ai_generated
            ? 'AI-gegenereerde afbeelding via Gemini'
            : `Foto door ${image.photographer} via Pexels`;
          bodyContent += `
<figure style="margin: 1.5rem 0;">
  <img src="${image.url}" alt="${image.alt || ''}" style="max-width: 100%; border-radius: 0.5rem;">
  ${image.caption ? `<figcaption style="font-size: 0.875rem; color: #1e293b; font-style: italic; border-left: 2px solid #3b82f6; padding-left: 0.75rem; margin-top: 0.5rem;">${image.caption}</figcaption>` : ''}
  <figcaption style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">${sourceCaption}</figcaption>
</figure>`;
        }
      }
    }

    bodyContent += '</article>';
  });

  // Close content wrapper
  bodyContent += `</div>`;

  const htmlContent = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${handboek.titel}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 0; line-height: 1.6; }
    .content-wrapper { max-width: 800px; margin: 0 auto; padding: 2rem; }
    .katex-display { margin: 1rem 0; }

    /* Full-page cover styles */
    .cover-page {
      position: relative;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cover-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 1;
    }
    .cover-overlay {
      position: relative;
      z-index: 2;
      text-align: center;
      color: white;
      padding: 2rem;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 1rem;
      max-width: 80%;
    }
    .cover-title {
      font-size: 3rem;
      font-weight: bold;
      margin-bottom: 1rem;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    }
    .cover-description {
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }
    .cover-meta {
      font-size: 1rem;
      opacity: 0.9;
    }

    /* Fallback title page */
    .title-page {
      text-align: center;
      padding: 4rem 2rem;
      min-height: 80vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 2rem;
    }

    h1 { font-size: 1.875rem; margin-bottom: 1rem; }
    h2 { font-size: 1.375rem; margin-top: 2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
    h3 { font-size: 1.125rem; margin-top: 1.5rem; }
    ul, ol { padding-left: 1.5rem; }
    li { margin-bottom: 0.5rem; }
    img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
    figcaption { font-size: 0.75rem; color: #64748b; }
    nav { margin-bottom: 3rem; padding: 1.5rem; background: #f8fafc; border-radius: 0.5rem; }
    article { margin-bottom: 3rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; }

    @media print {
      .cover-page {
        height: 100vh;
        page-break-after: always;
      }
      .title-page {
        height: 100vh;
        page-break-after: always;
      }
      nav { page-break-after: always; }
      article { page-break-before: always; }
      article:first-of-type { page-break-before: auto; }
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename = `${handboek.titel.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.html`;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Export complete handboek as Markdown
export const exportHandboekAsMarkdown = (
  handboek: Handboek,
  hoofdstukken: Hoofdstuk[]
): void => {
  let content = '';

  // Title and metadata
  content += `# ${handboek.titel}\n\n`;
  if (handboek.beschrijving) {
    content += `*${handboek.beschrijving}*\n\n`;
  }
  content += `**Niveau:** ${NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Leerjaar ${handboek.leerjaar}\n`;
  if (handboek.context) {
    content += `**Context:** ${handboek.context}\n`;
  }
  content += '\n---\n\n';

  // Table of contents
  content += '## Inhoudsopgave\n\n';
  hoofdstukken.forEach((h, i) => {
    content += `${i + 1}. ${h.titel}\n`;
  });
  content += '\n---\n\n';

  // Chapters
  hoofdstukken.forEach((hoofdstuk, index) => {
    content += `## Hoofdstuk ${index + 1}\n\n`;
    // Remove image placeholders for markdown export
    const cleanContent = hoofdstuk.content.replace(/\[AFBEELDING:\s*[^\]]+\]/g, '');
    content += cleanContent + '\n\n---\n\n';
  });

  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename = `${handboek.titel.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.md`;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
