import { NextRequest, NextResponse } from 'next/server';
import { ChapterImage } from '@/types';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

interface PexelsPhoto {
  id: number;
  src: {
    large: string;
    medium: string;
  };
  alt: string;
  photographer: string;
  photographer_url: string;
}

interface PexelsResponse {
  photos: PexelsPhoto[];
}

export async function POST(request: NextRequest) {
  try {
    const { searchTerms }: { searchTerms: string[] } = await request.json();

    if (!PEXELS_API_KEY) {
      console.error('Pexels API key not configured');
      return NextResponse.json({ images: [] });
    }

    if (!searchTerms || searchTerms.length === 0) {
      return NextResponse.json({ images: [] });
    }

    const images: ChapterImage[] = [];

    for (const terms of searchTerms) {
      try {
        // Clean up the search term: remove commas, take first 2-3 words if too long
        const cleanedTerms = terms
          .trim()
          .replace(/,/g, ' ')
          .split(/\s+/)
          .slice(0, 3)
          .join(' ');

        const query = encodeURIComponent(cleanedTerms);

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(
          `https://api.pexels.com/v1/search?query=${query}&per_page=3&orientation=landscape`,
          {
            headers: {
              Authorization: PEXELS_API_KEY,
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`Pexels API error for "${terms}":`, response.status);
          continue;
        }

        const data: PexelsResponse = await response.json();

        if (data.photos && data.photos.length > 0) {
          // Pick a random photo from the results for variety
          const randomIndex = Math.floor(Math.random() * data.photos.length);
          const photo = data.photos[randomIndex];
          images.push({
            url: photo.src.large,
            alt: photo.alt || cleanedTerms,
            photographer: photo.photographer,
            photographerUrl: photo.photographer_url,
          });
        }
      } catch (err) {
        console.error(`Error fetching image for "${terms}":`, err);
      }
    }

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Images API error:', error);
    return NextResponse.json({ images: [] });
  }
}
