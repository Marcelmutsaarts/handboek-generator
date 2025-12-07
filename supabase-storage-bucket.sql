-- Maak een publieke Storage bucket voor publieke handboeken
-- Voer dit uit in de Supabase SQL Editor

-- Bucket aanmaken (indien nog niet bestaat)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'publiek-handboeken',
  'publiek-handboeken',
  true,  -- publiek toegankelijk
  52428800,  -- 50MB max file size
  ARRAY['text/html']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['text/html']::text[];

-- Policy: iedereen kan publieke bestanden lezen
CREATE POLICY "Publieke handboeken zijn leesbaar" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'publiek-handboeken');

-- Policy: ingelogde gebruikers kunnen uploaden
CREATE POLICY "Ingelogde gebruikers kunnen uploaden" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'publiek-handboeken');

-- Policy: ingelogde gebruikers kunnen hun uploads verwijderen
CREATE POLICY "Ingelogde gebruikers kunnen verwijderen" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'publiek-handboeken');

-- Policy: ingelogde gebruikers kunnen updaten (upsert)
CREATE POLICY "Ingelogde gebruikers kunnen updaten" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'publiek-handboeken')
WITH CHECK (bucket_id = 'publiek-handboeken');
