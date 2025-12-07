'use client';

import { useState } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import { ChapterImage } from '@/types';

interface ChapterDisplayProps {
  content: string;
  prompt: string;
  images: ChapterImage[];
  isStreaming: boolean;
}

export default function ChapterDisplay({
  content,
  prompt,
  images,
  isStreaming,
}: ChapterDisplayProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  const renderContentWithImages = () => {
    if (!content) return null;

    // Split content by image placeholders
    const parts = content.split(/\[AFBEELDING:\s*([^\]]+)\]/g);
    let imageIndex = 0;

    return parts.map((part, index) => {
      // Even indices are content, odd indices are image search terms
      if (index % 2 === 0) {
        return (
          <div
            key={index}
            className="prose"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(part) }}
          />
        );
      } else {
        // This is an image placeholder - check if we have an image for it
        const image = images[imageIndex];
        imageIndex++;

        if (image) {
          return (
            <figure key={index} className="my-6">
              <img
                src={image.url}
                alt={image.alt}
                className="w-full max-w-2xl rounded-lg shadow-md"
              />
              {image.caption && (
                <figcaption className="text-sm text-foreground mt-2 italic border-l-2 border-primary pl-3">
                  {image.caption}
                </figcaption>
              )}
              <figcaption className="text-xs text-secondary mt-1">
                {image.isAiGenerated ? (
                  'AI-gegenereerde afbeelding via Gemini'
                ) : (
                  <>
                    Foto door{' '}
                    <a
                      href={image.photographerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-primary"
                    >
                      {image.photographer}
                    </a>{' '}
                    via Pexels
                  </>
                )}
              </figcaption>
            </figure>
          );
        }
        return null;
      }
    });
  };

  const parseMarkdown = (text: string): string => {
    if (!text) return '';

    return text
      // Headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Numbered lists
      .replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>')
      // Bullet lists
      .replace(/^[-•]\s+(.*$)/gm, '<li>$1</li>')
      // Wrap consecutive li elements in ul/ol
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => {
        const isNumbered = text.includes('1.');
        const tag = isNumbered ? 'ol' : 'ul';
        return `<${tag}>${match}</${tag}>`;
      })
      // Paragraphs (double newlines)
      .replace(/\n\n/g, '</p><p>')
      // Single newlines within content
      .replace(/\n/g, '<br>')
      // Wrap in paragraph tags
      .replace(/^(.+)$/s, '<p>$1</p>')
      // Clean up empty paragraphs
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/<p><h/g, '<h')
      .replace(/<\/h(\d)><\/p>/g, '</h$1>')
      .replace(/<p><(ul|ol)>/g, '<$1>')
      .replace(/<\/(ul|ol)><\/p>/g, '</$1>');
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hoofdstuk.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHTML = () => {
    // Split content by image placeholders and insert images at correct positions
    const parts = content.split(/\[AFBEELDING:\s*([^\]]+)\]/g);
    let imageIndex = 0;
    let bodyContent = '';

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Text content
        bodyContent += parseMarkdown(parts[i]);
      } else {
        // Image placeholder - insert image if available
        const image = images[imageIndex];
        imageIndex++;
        if (image) {
          const sourceCaption = image.isAiGenerated
            ? 'AI-gegenereerde afbeelding via Gemini'
            : `Foto door ${image.photographer} via Pexels`;
          bodyContent += `
<figure>
  <img src="${image.url}" alt="${image.alt}">
  ${image.caption ? `<figcaption class="image-caption">${image.caption}</figcaption>` : ''}
  <figcaption class="source-caption">${sourceCaption}</figcaption>
</figure>`;
        }
      }
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gegenereerd Hoofdstuk</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { font-size: 1.875rem; margin-bottom: 1rem; }
    h2 { font-size: 1.375rem; margin-top: 2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
    ul, ol { padding-left: 1.5rem; }
    li { margin-bottom: 0.5rem; }
    img { max-width: 100%; border-radius: 0.5rem; margin: 1rem 0; }
    figure { margin: 1.5rem 0; }
    .image-caption { font-size: 0.875rem; color: #1e293b; font-style: italic; border-left: 2px solid #3b82f6; padding-left: 0.75rem; margin-top: 0.5rem; }
    .source-caption { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
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
    a.download = 'hoofdstuk.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      alert('Inhoud gekopieerd naar klembord!');
    } catch {
      alert('Kopiëren mislukt. Probeer het opnieuw.');
    }
  };

  const handleExportWord = async () => {
    const parts = content.split(/\[AFBEELDING:\s*([^\]]+)\]/g);
    let imageIndex = 0;
    const docElements: Paragraph[] = [];

    // Helper to convert image URL to buffer
    const fetchImageAsBuffer = async (url: string): Promise<ArrayBuffer | null> => {
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

    // Process content parts
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Text content - parse markdown
        const textPart = parts[i];
        const lines = textPart.split('\n');

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // H1
          if (trimmedLine.startsWith('# ')) {
            docElements.push(
              new Paragraph({
                text: trimmedLine.slice(2),
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
              })
            );
          }
          // H2
          else if (trimmedLine.startsWith('## ')) {
            docElements.push(
              new Paragraph({
                text: trimmedLine.slice(3),
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
              })
            );
          }
          // H3
          else if (trimmedLine.startsWith('### ')) {
            docElements.push(
              new Paragraph({
                text: trimmedLine.slice(4),
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 100 },
              })
            );
          }
          // Numbered list
          else if (/^\d+\.\s/.test(trimmedLine)) {
            const text = trimmedLine.replace(/^\d+\.\s/, '');
            docElements.push(
              new Paragraph({
                children: parseInlineFormatting(text),
                numbering: { reference: 'numbered-list', level: 0 },
                spacing: { before: 100, after: 100 },
              })
            );
          }
          // Bullet list (supports -, •, and * markers)
          else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ') || trimmedLine.startsWith('* ')) {
            const text = trimmedLine.slice(2);
            docElements.push(
              new Paragraph({
                children: parseInlineFormatting(text),
                bullet: { level: 0 },
                spacing: { before: 100, after: 100 },
              })
            );
          }
          // Regular paragraph
          else {
            docElements.push(
              new Paragraph({
                children: parseInlineFormatting(trimmedLine),
                spacing: { before: 100, after: 100 },
              })
            );
          }
        }
      } else {
        // Image placeholder
        const image = images[imageIndex];
        imageIndex++;

        if (image) {
          const imageBuffer = await fetchImageAsBuffer(image.url);
          if (imageBuffer) {
            // Add image
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
          children: docElements,
        },
      ],
    });

    // Generate and download
    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, 'hoofdstuk.docx');
  };

  // Helper function to parse bold and italic in text
  const parseInlineFormatting = (text: string): TextRun[] => {
    const runs: TextRun[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      // Check for bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Check for italic
      const italicMatch = remaining.match(/\*(.+?)\*/);

      if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
        // Add text before bold
        if (boldMatch.index! > 0) {
          runs.push(new TextRun({ text: remaining.slice(0, boldMatch.index) }));
        }
        // Add bold text
        runs.push(new TextRun({ text: boldMatch[1], bold: true }));
        remaining = remaining.slice(boldMatch.index! + boldMatch[0].length);
      } else if (italicMatch) {
        // Add text before italic
        if (italicMatch.index! > 0) {
          runs.push(new TextRun({ text: remaining.slice(0, italicMatch.index) }));
        }
        // Add italic text
        runs.push(new TextRun({ text: italicMatch[1], italics: true }));
        remaining = remaining.slice(italicMatch.index! + italicMatch[0].length);
      } else {
        // No more formatting, add rest of text
        runs.push(new TextRun({ text: remaining }));
        break;
      }
    }

    return runs.length > 0 ? runs : [new TextRun({ text })];
  };

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex flex-wrap gap-2 pb-4 border-b border-border">
        <button
          onClick={handleExportMarkdown}
          disabled={isStreaming}
          className="px-4 py-2 text-sm bg-white border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
        >
          Download Markdown
        </button>
        <button
          onClick={handleExportHTML}
          disabled={isStreaming}
          className="px-4 py-2 text-sm bg-white border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
        >
          Download HTML
        </button>
        <button
          onClick={handleExportWord}
          disabled={isStreaming}
          className="px-4 py-2 text-sm bg-white border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
        >
          Download Word
        </button>
        <button
          onClick={handleCopyToClipboard}
          disabled={isStreaming}
          className="px-4 py-2 text-sm bg-white border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
        >
          Kopieer tekst
        </button>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          {showPrompt ? 'Verberg prompt' : 'Bekijk gebruikte prompt'}
        </button>
      </div>

      {/* Prompt display */}
      {showPrompt && (
        <div className="bg-accent rounded-lg p-4 border border-border">
          <h3 className="font-medium mb-2 text-sm">Gebruikte prompt:</h3>
          <p className="text-xs text-secondary mb-3">
            Deze prompt kun je zelf gebruiken in ChatGPT, Claude of andere AI-tools om vergelijkbare hoofdstukken te genereren.
          </p>
          <pre className="text-xs bg-white p-4 rounded border border-border overflow-x-auto whitespace-pre-wrap">
            {prompt}
          </pre>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(prompt);
              alert('Prompt gekopieerd!');
            }}
            className="mt-2 px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary-hover transition-colors"
          >
            Kopieer prompt
          </button>
        </div>
      )}

      {/* Generated content */}
      <div className="bg-white rounded-lg p-6 border border-border min-h-[400px]">
        {renderContentWithImages()}
        {isStreaming && (
          <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
}
