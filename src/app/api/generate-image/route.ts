import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'google/gemini-2.5-flash-image';

interface ImageResponse {
  type: string;
  image_url: {
    url: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, onderwerp }: { prompt: string; onderwerp: string } = await request.json();

    if (!OPENROUTER_API_KEY) {
      console.error('OpenRouter API key not configured');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Create a detailed image generation prompt
    const imagePrompt = `Generate a professional, educational photograph or illustration for a textbook chapter about "${onderwerp}".

The image should show: ${prompt}

Style requirements:
- Photorealistic or high-quality illustration
- Suitable for educational materials
- Clear, well-lit, professional appearance
- No text overlays or watermarks
- Engaging and relevant to the topic`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://handboek-generator.app',
        'X-Title': 'Handboek Generator',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: imagePrompt,
          },
        ],
        modalities: ['image', 'text'],
        image_config: {
          aspect_ratio: '16:9',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter image generation error:', error);
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    // Check for images in the response
    if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
      const imageData = message.images[0] as ImageResponse;
      if (imageData.image_url?.url) {
        return NextResponse.json({
          imageUrl: imageData.image_url.url,
          alt: prompt
        });
      }
    }

    // If no image found in response
    console.error('No image in response:', JSON.stringify(data, null, 2));
    return NextResponse.json({ error: 'No image generated' }, { status: 500 });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
  }
}
