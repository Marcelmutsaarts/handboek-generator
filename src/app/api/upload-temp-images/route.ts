import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decodeDataUri, getExtensionFromMimeType } from '@/lib/base64';

/**
 * Upload base64 images to Supabase Storage and return HTTPS URLs
 * Used for quality check to avoid Vercel's 4.5MB body limit
 *
 * Falls back gracefully - if this fails, quality check continues with text-only analysis
 */
export const runtime = 'nodejs';
export const maxDuration = 30;

interface ImageToUpload {
  url: string; // base64 data URI
  index: number;
}

interface UploadedImage {
  originalIndex: number;
  publicUrl: string;
}

export async function POST(request: NextRequest) {
  try {
    const { images, sessionId }: { images: ImageToUpload[]; sessionId: string } = await request.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
    }

    const uploadedImages: UploadedImage[] = [];
    const bucketName = 'temp-quality-images';

    // Upload each image
    for (const img of images) {
      if (!img.url || !img.url.startsWith('data:')) {
        continue;
      }

      const decoded = decodeDataUri(img.url);
      if (!decoded) {
        console.warn(`Invalid base64 image at index ${img.index}, skipping`);
        continue;
      }

      const ext = getExtensionFromMimeType(decoded.mimeType);
      // Use sessionId + timestamp + index for unique filename
      const fileName = `${user.id}/${sessionId}/img-${img.index}-${Date.now()}.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, decoded.buffer, {
          contentType: decoded.mimeType,
          cacheControl: '300', // 5 min cache (temporary)
          upsert: true,
        });

      if (uploadError) {
        console.error(`Upload error for image ${img.index}:`, uploadError.message);
        // Continue with other images
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        uploadedImages.push({
          originalIndex: img.index,
          publicUrl: urlData.publicUrl,
        });
      }
    }

    return NextResponse.json({
      success: true,
      uploadedImages,
      uploadedCount: uploadedImages.length,
      requestedCount: images.length,
    });

  } catch (error) {
    console.error('Upload temp images error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
