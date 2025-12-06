-- Migratie: Publieke handboeken functionaliteit
-- Voer dit uit in de Supabase SQL Editor

-- Voeg kolommen toe voor publieke toegang
ALTER TABLE handboeken
ADD COLUMN IF NOT EXISTS is_publiek BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS publieke_slug TEXT UNIQUE;

-- Index voor snelle lookup op slug
CREATE INDEX IF NOT EXISTS idx_handboeken_publieke_slug ON handboeken(publieke_slug) WHERE publieke_slug IS NOT NULL;

-- =====================================================
-- BELANGRIJKE FIX: Vervang bestaande SELECT policies
-- De oude policies werken alleen voor eigen data.
-- De nieuwe policies werken voor eigen data OF publieke data.
-- =====================================================

-- Verwijder ALLE bestaande SELECT policies
DROP POLICY IF EXISTS "Gebruikers kunnen eigen handboeken zien" ON handboeken;
DROP POLICY IF EXISTS "Publieke handboeken zijn leesbaar voor iedereen" ON handboeken;
DROP POLICY IF EXISTS "Gebruikers kunnen hoofdstukken van eigen handboeken zien" ON hoofdstukken;
DROP POLICY IF EXISTS "Hoofdstukken van publieke handboeken zijn leesbaar" ON hoofdstukken;
DROP POLICY IF EXISTS "Gebruikers kunnen afbeeldingen van eigen hoofdstukken zien" ON afbeeldingen;
DROP POLICY IF EXISTS "Afbeeldingen van publieke handboeken zijn leesbaar" ON afbeeldingen;

-- Nieuwe gecombineerde policy voor handboeken (eigen OF publiek)
CREATE POLICY "Gebruikers kunnen eigen handboeken zien"
ON handboeken
FOR SELECT
TO anon, authenticated
USING (
  auth.uid() = user_id
  OR (is_publiek = TRUE AND publieke_slug IS NOT NULL)
);

-- Nieuwe gecombineerde policy voor hoofdstukken (eigen OF publiek)
-- Gebruik IN voor betere performance
CREATE POLICY "Gebruikers kunnen hoofdstukken van eigen handboeken zien"
ON hoofdstukken
FOR SELECT
TO anon, authenticated
USING (
  handboek_id IN (
    SELECT id FROM handboeken
    WHERE user_id = auth.uid() OR is_publiek = TRUE
  )
);

-- Nieuwe gecombineerde policy voor afbeeldingen (eigen OF publiek)
-- Gebruik een simpelere query structuur voor betere performance
CREATE POLICY "Gebruikers kunnen afbeeldingen van eigen hoofdstukken zien"
ON afbeeldingen
FOR SELECT
TO anon, authenticated
USING (
  hoofdstuk_id IN (
    SELECT h.id FROM hoofdstukken h
    INNER JOIN handboeken hb ON hb.id = h.handboek_id
    WHERE hb.user_id = auth.uid() OR hb.is_publiek = TRUE
  )
);
