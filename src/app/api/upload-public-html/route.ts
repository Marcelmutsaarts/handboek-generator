import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertValidSlug } from '@/lib/slug';

// Helper to convert base64 to blob
function base64ToBlob(base64: string): { blob: Blob; mimeType: string } | null {
  try {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;

    const mimeType = match[1];
    const data = match[2];
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    return { blob: new Blob([bytes], { type: mimeType }), mimeType };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { slug, html, images } = await request.json();

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

    const imageUrlMap: Record<string, string> = {};

    // Upload images first (if provided)
    if (images && Array.isArray(images)) {
      for (let i = 0; i < images.length; i++) {
        const imgData = images[i];
        if (!imgData.url || !imgData.url.startsWith('data:')) continue;

        const result = base64ToBlob(imgData.url);
        if (!result) continue;

        const ext = result.mimeType.split('/')[1] || 'png';
        const fileName = `${slug}/img-${i}.${ext}`;

        // Delete existing file if any
        await supabase.storage.from('publiek-handboeken').remove([fileName]);

        // Upload new file
        const { error: uploadError } = await supabase.storage
          .from('publiek-handboeken')
          .upload(fileName, result.blob, {
            contentType: result.mimeType,
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
      const htmlBlob = new Blob([html], { type: 'text/html' });

      await supabase.storage.from('publiek-handboeken').remove([fileName]);

      const { error: uploadError } = await supabase.storage
        .from('publiek-handboeken')
        .upload(fileName, htmlBlob, {
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
