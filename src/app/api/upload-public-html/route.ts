import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertValidSlug } from '@/lib/slug';
import { decodeDataUri, getExtensionFromMimeType } from '@/lib/base64';

/**
 * Runtime: Node.js
 *
 * Why Node.js runtime:
 * - Consistent Buffer support for binary handling (no atob/Blob polyfills)
 * - Reliable base64 decoding without runtime compatibility issues
 * - Stable across Vercel/Next.js deployment environments
 * - No edge runtime limitations for binary data processing
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { slug, html, images } = await request.json();

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug is vereist' },
        { status: 400 }
      );
    }

    // Validate HTML content is present and is a string
    if (!html || typeof html !== 'string' || html.trim().length === 0) {
      return NextResponse.json(
        { error: 'HTML content is vereist' },
        { status: 400 }
      );
    }

    // Validate slug for security (prevent path traversal, injection)
    try {
      assertValidSlug(slug);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Ongeldige slug',
        },
        { status: 400 }
      );
    }

    // Validate images array if provided
    if (images !== undefined && !Array.isArray(images)) {
      return NextResponse.json(
        { error: 'Images moet een array zijn' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet ingelogd' },
        { status: 401 }
      );
    }

    const imageUrlMap: Record<string, string> = {};

    // Upload images first (if provided)
    if (images && Array.isArray(images)) {
      for (let i = 0; i < images.length; i++) {
        const imgData = images[i];
        if (!imgData.url || !imgData.url.startsWith('data:')) continue;

        // Decode base64 data URI using runtime-safe Buffer approach
        const decoded = decodeDataUri(imgData.url);
        if (!decoded) {
          console.warn(`Invalid base64 image at index ${i}, skipping`);
          continue;
        }

        const ext = getExtensionFromMimeType(decoded.mimeType);
        const fileName = `${slug}/img-${i}.${ext}`;

        // Delete existing file if any
        await supabase.storage.from('publiek-handboeken').remove([fileName]);

        // Upload new file using Buffer (Node.js runtime)
        const { error: uploadError } = await supabase.storage
          .from('publiek-handboeken')
          .upload(fileName, decoded.buffer, {
            contentType: decoded.mimeType,
            cacheControl: '31536000', // 1 year cache
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('publiek-handboeken')
            .getPublicUrl(fileName);
          imageUrlMap[imgData.url] = urlData.publicUrl;
        }
      }
    }

    // Upload HTML file
    if (html) {
      const fileName = `${slug}.html`;

      // Convert HTML string to Buffer (Node.js runtime)
      const htmlBuffer = Buffer.from(html, 'utf-8');

      await supabase.storage.from('publiek-handboeken').remove([fileName]);

      const { error: uploadError } = await supabase.storage
        .from('publiek-handboeken')
        .upload(fileName, htmlBuffer, {
          contentType: 'text/html',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return NextResponse.json(
          { error: `Upload mislukt: ${uploadError.message}` },
          { status: 500 }
        );
      }
    }

    // Get the public URL for HTML
    const { data: urlData } = supabase.storage
      .from('publiek-handboeken')
      .getPublicUrl(`${slug}.html`);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      imageUrlMap,
    });
  } catch (error) {
    console.error('Error uploading public HTML:', error);
    return NextResponse.json(
      { error: 'Er ging iets mis bij het uploaden' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { slug } = await request.json();

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug is vereist' },
        { status: 400 }
      );
    }

    // Validate slug for security (prevent path traversal, injection)
    try {
      assertValidSlug(slug);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Ongeldige slug',
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet ingelogd' },
        { status: 401 }
      );
    }

    // Delete all files for this slug (HTML + images folder)
    const { data: files } = await supabase.storage
      .from('publiek-handboeken')
      .list(slug);

    if (files && files.length > 0) {
      const filesToDelete = files.map(f => `${slug}/${f.name}`);
      await supabase.storage.from('publiek-handboeken').remove(filesToDelete);
    }

    // Delete the HTML file
    await supabase.storage.from('publiek-handboeken').remove([`${slug}.html`]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting public HTML:', error);
    return NextResponse.json(
      { error: 'Er ging iets mis bij het verwijderen' },
      { status: 500 }
    );
  }
}
