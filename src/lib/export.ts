import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, PageBreak } from 'docx';
import { saveAs } from 'file-saver';
import { Handboek, Hoofdstuk, Afbeelding } from '@/types';

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

// Helper function to parse bold and italic in text
export const parseInlineFormatting = (text: string): TextRun[] => {
  const runs: TextRun[] = [];
  let remaining = text;

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

  return runs.length > 0 ? runs : [new TextRun({ text })];
};

// Parse markdown to HTML
export const parseMarkdown = (text: string): string => {
  if (!text) return '';

  return text
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>')
    .replace(/^[-•*]\s+(.*$)/gm, '<li>$1</li>')
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

          const caption = image.isAiGenerated
            ? 'AI-gegenereerde afbeelding via Gemini'
            : `Foto door ${image.photographer} via Pexels`;
          docElements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: caption,
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
  const allElements: Paragraph[] = [];

  // Title page
  allElements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: handboek.titel,
          bold: true,
          size: 56,
        }),
      ],
      spacing: { before: 2000, after: 400 },
    })
  );

  if (handboek.beschrijving) {
    allElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: handboek.beschrijving,
            size: 28,
            color: '666666',
          }),
        ],
        spacing: { after: 400 },
      })
    );
  }

  allElements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Leerjaar ${handboek.leerjaar}`,
          size: 24,
          color: '888888',
        }),
      ],
      spacing: { after: 200 },
    })
  );

  if (handboek.context) {
    allElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Context: ${handboek.context}`,
            size: 24,
            color: '888888',
            italics: true,
          }),
        ],
        spacing: { after: 400 },
      })
    );
  }

  // Table of contents
  allElements.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  allElements.push(
    new Paragraph({
      text: 'Inhoudsopgave',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 300 },
    })
  );

  hoofdstukken.forEach((hoofdstuk, index) => {
    allElements.push(
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
    allElements.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    // Chapter number header
    allElements.push(
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
      photographer: afb.photographer || undefined,
      isAiGenerated: afb.is_ai_generated,
    }));

    // Process chapter content
    const chapterElements = await processContentForWord(hoofdstuk.content, chapterImages);
    allElements.push(...chapterElements);
  }

  // Create document
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
      {
        children: allElements,
      },
    ],
  });

  // Generate and download
  const buffer = await Packer.toBlob(doc);
  const filename = `${handboek.titel.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.docx`;
  saveAs(buffer, filename);
};

// Export complete handboek as HTML
export const exportHandboekAsHTML = (
  handboek: Handboek,
  hoofdstukken: Hoofdstuk[],
  afbeeldingenPerHoofdstuk: Record<string, Afbeelding[]>
): void => {
  let bodyContent = '';

  // Title
  bodyContent += `<header style="text-align: center; margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 2px solid #e2e8f0;">
    <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">${handboek.titel}</h1>
    ${handboek.beschrijving ? `<p style="color: #64748b; font-size: 1.1rem;">${handboek.beschrijving}</p>` : ''}
    <p style="color: #94a3b8; font-size: 0.9rem;">
      ${NIVEAU_LABELS[handboek.niveau] || handboek.niveau} - Leerjaar ${handboek.leerjaar}
      ${handboek.context ? ` | ${handboek.context}` : ''}
    </p>
  </header>`;

  // Table of contents
  bodyContent += `<nav style="margin-bottom: 3rem; padding: 1.5rem; background: #f8fafc; border-radius: 0.5rem;">
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
          const caption = image.is_ai_generated
            ? 'AI-gegenereerde afbeelding via Gemini'
            : `Foto door ${image.photographer} via Pexels`;
          bodyContent += `
<figure style="margin: 1.5rem 0;">
  <img src="${image.url}" alt="${image.alt || ''}" style="max-width: 100%; border-radius: 0.5rem;">
  <figcaption style="font-size: 0.75rem; color: #64748b; margin-top: 0.5rem;">${caption}</figcaption>
</figure>`;
        }
      }
    }

    bodyContent += '</article>';
  });

  const htmlContent = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${handboek.titel}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { font-size: 1.875rem; margin-bottom: 1rem; }
    h2 { font-size: 1.375rem; margin-top: 2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
    h3 { font-size: 1.125rem; margin-top: 1.5rem; }
    ul, ol { padding-left: 1.5rem; }
    li { margin-bottom: 0.5rem; }
    img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
    figcaption { font-size: 0.75rem; color: #64748b; }
    @media print {
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
