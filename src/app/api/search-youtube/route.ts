import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

interface YouTubeSearchResult {
  title: string;
  videoId: string;
  url: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
}

interface YouTubeAPIResponse {
  items?: {
    id: { videoId: string };
    snippet: {
      title: string;
      channelTitle: string;
      description: string;
      thumbnails: {
        medium?: { url: string };
        default?: { url: string };
      };
    };
  }[];
  error?: {
    message: string;
    code: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { query, maxResults = 3 } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('YouTube API key not configured');
      return NextResponse.json(
        { error: 'YouTube API not configured' },
        { status: 500 }
      );
    }

    // Search YouTube Data API v3
    const searchParams = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(Math.min(maxResults, 10)),
      videoEmbeddable: 'true',
      relevanceLanguage: 'nl', // Prefer Dutch results
      safeSearch: 'strict', // Safe for education
      key: apiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorData: YouTubeAPIResponse = await response.json();
      console.error('YouTube API error:', errorData.error);
      return NextResponse.json(
        { error: errorData.error?.message || 'YouTube API error' },
        { status: response.status }
      );
    }

    const data: YouTubeAPIResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ videos: [] });
    }

    // Transform to simpler format
    const videos: YouTubeSearchResult[] = data.items.map((item) => ({
      title: item.snippet.title,
      videoId: item.id.videoId,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      channelTitle: item.snippet.channelTitle,
      description: item.snippet.description.slice(0, 200),
      thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
    }));

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('YouTube search error:', error);
    return NextResponse.json(
      { error: 'Failed to search YouTube' },
      { status: 500 }
    );
  }
}
