import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { slug, html } = await request.json();

    if (!slug || !html) {
      return NextResponse.json(
        { error: 'Slug en HTML zijn vereist' },
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

    // Upload HTML to Supabase Storage
    const fileName = `${slug}.html`;
    const htmlBlob = new Blob([html], { type: 'text/html' });

    // First, try to delete any existing file with this name
    await supabase.storage
      .from('publiek-handboeken')
      .remove([fileName]);

    // Upload the new file
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

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('publiek-handboeken')
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
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

    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet ingelogd' },
        { status: 401 }
      );
    }

    // Delete the file from storage
    const fileName = `${slug}.html`;
    const { error: deleteError } = await supabase.storage
      .from('publiek-handboeken')
      .remove([fileName]);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      // Don't fail if file doesn't exist
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting public HTML:', error);
    return NextResponse.json(
      { error: 'Er ging iets mis bij het verwijderen' },
      { status: 500 }
    );
  }
}
